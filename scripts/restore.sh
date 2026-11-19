#!/usr/bin/env bash
#
# FinCloud restore (Linux/macOS/CI). Mirrors scripts/restore.ps1.
#
# Usage:
#   ./scripts/restore.sh --latest --force
#   ./scripts/restore.sh --backup backups/20261107-020000 --database-only --force
#   ./scripts/restore.sh --latest --verify-only
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_ROOT="${BACKUP_DIR:-$SCRIPT_DIR/../backups}"
DATABASE="${DB_NAME:-fincloud_db}"
DB_CONTAINER="${DB_CONTAINER:-fincloud-mariadb}"
STORAGE_CONTAINER="${STORAGE_CONTAINER:-fincloud-minio}"
BUCKET="${MINIO_BUCKET:-fincloud-receipts}"
TARGET_DATABASE="${RESTORE_TARGET_DATABASE:-fincloud_restore_test}"

BACKUP_PATH=""
USE_LATEST=0
DATABASE_ONLY=0
STORAGE_ONLY=0
FORCE=0
SKIP_PRE_BACKUP=0
VERIFY_ONLY=0

TEMP_DB="/tmp/fincloud_restore.sql.gz"
TEMP_STORAGE="/tmp/fincloud_restore_receipts.tar.gz"
CLIENT_TOOL=""

log() {
  local level="$1"; shift
  printf '[%s] [%s] %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$level" "$*"
}

die() {
  log ERROR "$*"
  exit 1
}

usage() {
  grep '^#' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup) BACKUP_PATH="$2"; shift 2 ;;
    --latest) USE_LATEST=1; shift ;;
    --output) OUTPUT_ROOT="$2"; shift 2 ;;
    --database) DATABASE="$2"; shift 2 ;;
    --database-only) DATABASE_ONLY=1; shift ;;
    --storage-only) STORAGE_ONLY=1; shift ;;
    --force) FORCE=1; shift ;;
    --skip-pre-backup) SKIP_PRE_BACKUP=1; shift ;;
    --verify-only) VERIFY_ONLY=1; shift ;;
    --target-database) TARGET_DATABASE="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) die "Argumen tidak dikenal: $1" ;;
  esac
done

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    openssl dgst -sha256 "$1" | awk '{print $NF}'
  fi
}

container_running() {
  [[ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || echo false)" == "true" ]]
}

get_client_tool() {
  if [[ -n "$CLIENT_TOOL" ]]; then
    printf '%s' "$CLIENT_TOOL"
    return
  fi
  CLIENT_TOOL="$(docker exec "$DB_CONTAINER" sh -c 'if command -v mariadb >/dev/null 2>&1; then echo mariadb; elif command -v mysql >/dev/null 2>&1; then echo mysql; else echo MISSING; fi')"
  [[ "$CLIENT_TOOL" != "MISSING" ]] || die "Client mariadb/mysql tidak ditemukan."
  printf '%s' "$CLIENT_TOOL"
}

assert_checksums() {
  local folder="$1"
  local sumfile="$folder/SHA256SUMS.txt"
  if [[ ! -f "$sumfile" ]]; then
    log WARN "SHA256SUMS.txt tidak ditemukan; verifikasi checksum dilewati."
    return
  fi
  local expected file actual
  while read -r expected file; do
    [[ -z "${expected:-}" || -z "${file:-}" ]] && continue
    [[ -f "$folder/$file" ]] || die "File backup hilang: $file"
    actual="$(sha256_file "$folder/$file")"
    [[ "$actual" == "$expected" ]] || die "Checksum tidak cocok untuk $file."
    log INFO "Checksum OK: $file"
  done < "$sumfile"
}

resolve_backup() {
  if [[ -n "$BACKUP_PATH" ]]; then
    [[ -d "$BACKUP_PATH" ]] || die "Folder backup tidak ditemukan: $BACKUP_PATH"
    (cd "$BACKUP_PATH" && pwd)
    return
  fi
  [[ "$USE_LATEST" -eq 1 ]] || die "Tentukan --backup <folder> atau --latest."

  if [[ -f "$OUTPUT_ROOT/last-backup.txt" ]]; then
    local candidate
    candidate="$(cat "$OUTPUT_ROOT/last-backup.txt")"
    [[ -d "$candidate" ]] && { printf '%s' "$candidate"; return; }
  fi

  local newest
  newest="$(find "$OUTPUT_ROOT" -mindepth 1 -maxdepth 1 -type d -name '20*-*' 2>/dev/null | sort -r | head -n 1 || true)"
  [[ -n "$newest" ]] || die "Tidak ada backup di $OUTPUT_ROOT."
  printf '%s' "$newest"
}

counts_for_db() {
  local db="$1"
  local client
  client="$(get_client_tool)"
  local sql="SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'transactions', COUNT(*) FROM transactions UNION ALL SELECT 'categories', COUNT(*) FROM categories UNION ALL SELECT 'receipts', COUNT(*) FROM receipts UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs"
  docker exec "$DB_CONTAINER" sh -c "MYSQL_PWD=\"\$MARIADB_ROOT_PASSWORD\" $client -uroot \"$db\" -N -e \"$sql\""
}

expected_counts() {
  local manifest="$1"
  grep -oE '"(users|transactions|categories|receipts|audit_logs)"[[:space:]]*:[[:space:]]*[0-9]+' "$manifest" |
    sed -E 's/"([a-z_]+)"[[:space:]]*:[[:space:]]*([0-9]+)/\1 \2/'
}

compare_counts() {
  local manifest="$1" db="$2"
  [[ -f "$manifest" ]] || { log WARN "manifest.json tidak ada; perbandingan row count dilewati."; return 0; }
  local actual problems=""
  actual="$(counts_for_db "$db")"
  local table want got
  while read -r table want; do
    [[ -z "${table:-}" ]] && continue
    got="$(awk -v t="$table" '$1 == t {print $2}' <<< "$actual")"
    if [[ "${got:-0}" != "$want" ]]; then
      problems+="$table expected=$want actual=${got:-0}; "
    fi
  done < <(expected_counts "$manifest")
  [[ -z "$problems" ]] || { log ERROR "Row count tidak cocok: $problems"; return 1; }
  log OK "Row count cocok dengan manifest."
}

restore_database() {
  local folder="$1" db="$2"
  local dump="$folder/fincloud_db.sql.gz"
  [[ -f "$dump" ]] || { log ERROR "Dump tidak ditemukan: $dump"; return 1; }
  local client
  client="$(get_client_tool)"

  log INFO "Menyalin dump ke container $DB_CONTAINER..."
  docker cp "$dump" "$DB_CONTAINER:$TEMP_DB" >/dev/null || return 1
  docker exec "$DB_CONTAINER" sh -c "gzip -t $TEMP_DB" || return 1

  local create_sql="CREATE DATABASE IF NOT EXISTS \`$db\`;"
  docker exec "$DB_CONTAINER" sh -c "MYSQL_PWD=\"\$MARIADB_ROOT_PASSWORD\" $client -uroot -e \"$create_sql\"" || return 1

  log INFO "Mengimpor dump ke '$db'..."
  docker exec "$DB_CONTAINER" sh -c "gzip -dc $TEMP_DB | MYSQL_PWD=\"\$MARIADB_ROOT_PASSWORD\" $client -uroot \"$db\"" || return 1
  docker exec "$DB_CONTAINER" rm -f "$TEMP_DB" || true
  log OK "Restore database '$db' selesai."
}

restore_storage() {
  local folder="$1"
  local archive="$folder/receipts.tar.gz"
  if [[ ! -f "$archive" ]]; then
    log WARN "receipts.tar.gz tidak ada; restore storage dilewati."
    return 0
  fi

  command -v tar >/dev/null 2>&1 || { log ERROR "Perintah 'tar' tidak ditemukan di host."; return 1; }

  local staging
  staging="$(mktemp -d)"
  log INFO "Mengekstrak arsip MinIO di host..."
  if ! tar -xzf "$archive" -C "$staging"; then
    rm -rf "$staging"
    log ERROR "Ekstraksi arsip MinIO gagal."
    return 1
  fi

  if [[ ! -d "$staging/$BUCKET" ]]; then
    rm -rf "$staging"
    log ERROR "Folder '$BUCKET' tidak ditemukan di dalam arsip."
    return 1
  fi

  log INFO "Mengganti isi bucket '$BUCKET'..."
  docker exec "$STORAGE_CONTAINER" rm -rf "/data/$BUCKET" || { rm -rf "$staging"; return 1; }
  docker cp "$staging/$BUCKET" "$STORAGE_CONTAINER:/data/$BUCKET" >/dev/null || { rm -rf "$staging"; return 1; }
  rm -rf "$staging"
  log OK "Restore bucket '$BUCKET' selesai."
}

stop_backend() {
  WAS_RUNNING=0
  if container_running fincloud-backend; then
    log INFO "Menyetop backend agar tidak ada write selama restore..."
    docker stop fincloud-backend >/dev/null || return 1
    WAS_RUNNING=1
  else
    log WARN "Container backend sudah berhenti."
  fi
  return 0
}

start_backend() {
  [[ "${WAS_RUNNING:-0}" -eq 1 ]] || return 0
  log INFO "Menjalankan kembali backend..."
  docker start fincloud-backend >/dev/null || return 1
  local i
  for i in $(seq 1 30); do
    if command -v curl >/dev/null 2>&1; then
      curl -fsS --max-time 3 http://localhost:5000/api/health >/dev/null 2>&1 && { log OK "Backend sehat (health check 200)."; return 0; }
    else
      sleep 2
      continue
    fi
    sleep 2
  done
  log WARN "Backend belum merespons health check setelah 60 detik."
  return 0
}

command -v docker >/dev/null 2>&1 || die "Docker CLI tidak ditemukan di PATH."
FOLDER="$(resolve_backup)"

if [[ "$DATABASE_ONLY" -eq 1 && "$STORAGE_ONLY" -eq 1 ]]; then
  die "Pilih salah satu: --database-only atau --storage-only."
fi
if [[ "$STORAGE_ONLY" -eq 0 && ! -f "$FOLDER/fincloud_db.sql.gz" ]]; then
  die "File fincloud_db.sql.gz tidak ada di $FOLDER."
fi

# ------------------------------------------------------------- verify only
if [[ "$VERIFY_ONLY" -eq 1 ]]; then
  [[ "$TARGET_DATABASE" != "$DATABASE" ]] || die "Target database tidak boleh sama dengan database produksi."
  log INFO "Mode verifikasi: restore ke database scratch '$TARGET_DATABASE'."
  assert_checksums "$FOLDER"

  local_client="$(get_client_tool)"
  docker cp "$FOLDER/fincloud_db.sql.gz" "$DB_CONTAINER:$TEMP_DB" >/dev/null
  docker exec "$DB_CONTAINER" sh -c "gzip -t $TEMP_DB" || die "Integritas gzip gagal."

  drop_create="DROP DATABASE IF EXISTS \`$TARGET_DATABASE\`; CREATE DATABASE \`$TARGET_DATABASE\`;"
  docker exec "$DB_CONTAINER" sh -c "MYSQL_PWD=\"\$MARIADB_ROOT_PASSWORD\" $local_client -uroot -e \"$drop_create\""
  docker exec "$DB_CONTAINER" sh -c "gzip -dc $TEMP_DB | MYSQL_PWD=\"\$MARIADB_ROOT_PASSWORD\" $local_client -uroot \"$TARGET_DATABASE\""

  compare_counts "$FOLDER/manifest.json" "$TARGET_DATABASE" || {
    log ERROR "Verifikasi GAGAL."
    docker exec "$DB_CONTAINER" sh -c "MYSQL_PWD=\"\$MARIADB_ROOT_PASSWORD\" $local_client -uroot -e \"DROP DATABASE IF EXISTS \`$TARGET_DATABASE\`;\"" || true
    exit 1
  }

  docker exec "$DB_CONTAINER" sh -c "MYSQL_PWD=\"\$MARIADB_ROOT_PASSWORD\" $local_client -uroot -e \"DROP DATABASE IF EXISTS \`$TARGET_DATABASE\`;\""
  docker exec "$DB_CONTAINER" rm -f "$TEMP_DB" || true

  if [[ "$DATABASE_ONLY" -eq 0 && -f "$FOLDER/receipts.tar.gz" ]]; then
    tar -tzf "$FOLDER/receipts.tar.gz" >/dev/null || die "Integritas arsip MinIO gagal."
    log OK "Verifikasi arsip MinIO OK."
  fi

  printf '\nVERIFY OK\n'
  exit 0
fi

# ------------------------------------------------------------------ restore
[[ "$FORCE" -eq 1 ]] || die "Restore menimpa data. Jalankan ulang dengan --force."

container_running "$DB_CONTAINER" || [[ "$STORAGE_ONLY" -eq 1 ]] || die "Container '$DB_CONTAINER' tidak berjalan."
container_running "$STORAGE_CONTAINER" || [[ "$DATABASE_ONLY" -eq 1 ]] || die "Container '$STORAGE_CONTAINER' tidak berjalan."

log INFO "Backup sumber: $FOLDER"
assert_checksums "$FOLDER"

PRE_BACKUP=""
if [[ "$SKIP_PRE_BACKUP" -eq 0 ]]; then
  log INFO "Membuat snapshot pra-restore..."
  bash "$SCRIPT_DIR/backup.sh" --output "$OUTPUT_ROOT" --retention-days 0 || die "Snapshot pra-restore gagal; restore dibatalkan."
  if [[ -f "$OUTPUT_ROOT/last-backup.txt" ]]; then
    PRE_BACKUP="$(cat "$OUTPUT_ROOT/last-backup.txt")"
    log INFO "Snapshot pra-restore: $PRE_BACKUP"
  fi
else
  log WARN "Snapshot pra-restore dilewati (--skip-pre-backup)."
fi

stop_backend || die "Gagal menyetop backend."

do_restore() {
  if [[ "$STORAGE_ONLY" -eq 0 ]]; then
    restore_database "$FOLDER" "$DATABASE" || return 1
  fi
  if [[ "$DATABASE_ONLY" -eq 0 ]]; then
    restore_storage "$FOLDER" || return 1
  fi
  if [[ "$STORAGE_ONLY" -eq 0 ]]; then
    compare_counts "$FOLDER/manifest.json" "$DATABASE" || return 1
  fi
  return 0
}

if do_restore; then
  start_backend
  printf '\nRESTORE OK -> %s\n' "$FOLDER"
  exit 0
fi

log ERROR "Restore gagal."
if [[ -n "$PRE_BACKUP" && -d "$PRE_BACKUP" ]]; then
  log WARN "Rollback ke snapshot pra-restore: $PRE_BACKUP"
  [[ "$STORAGE_ONLY" -eq 1 ]] || restore_database "$PRE_BACKUP" "$DATABASE" || log ERROR "Rollback database gagal."
  [[ "$DATABASE_ONLY" -eq 1 ]] || restore_storage "$PRE_BACKUP" || log ERROR "Rollback storage gagal."
fi
start_backend
exit 1

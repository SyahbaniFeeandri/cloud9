#!/usr/bin/env bash
#
# FinCloud automated backup (Linux/macOS/CI).
# Mirrors scripts/backup.ps1 and produces the same backup layout.
#
# Usage:
#   ./scripts/backup.sh [--output DIR] [--database NAME] [--retention-days N]
#                       [--skip-storage] [--dry-run]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_ROOT="${BACKUP_DIR:-$SCRIPT_DIR/../backups}"
METRICS_DIR="${FINCLOUD_METRICS_DIR:-$SCRIPT_DIR/../infra/node-exporter/textfile}"
DATABASE="${DB_NAME:-fincloud_db}"
DB_CONTAINER="${DB_CONTAINER:-fincloud-mariadb}"
STORAGE_CONTAINER="${STORAGE_CONTAINER:-fincloud-minio}"
BUCKET="${MINIO_BUCKET:-fincloud-receipts}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
SKIP_STORAGE=0
DRY_RUN=0

TEMP_DB="/tmp/fincloud_db.sql.gz"
TEMP_STORAGE="/tmp/fincloud_receipts.tar.gz"

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
    --output) OUTPUT_ROOT="$2"; shift 2 ;;
    --database) DATABASE="$2"; shift 2 ;;
    --retention-days) RETENTION_DAYS="$2"; shift 2 ;;
    --skip-storage) SKIP_STORAGE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
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

# Publishes backup freshness for node-exporter's textfile collector
# (infra/node-exporter/textfile/fincloud_backup.prom).
write_metrics() {
  local success="$1" duration="${2:-0}" size="${3:-0}"
  local target="$METRICS_DIR/fincloud_backup.prom"
  local last_success=0 last_duration=0 last_size=0 last=""

  mkdir -p "$METRICS_DIR" 2>/dev/null || return 0
  if [[ -f "$target" ]]; then
    last="$(awk '/^fincloud_backup_last_success_timestamp_seconds /{print $2; exit}' "$target" 2>/dev/null || true)"
    [[ -n "$last" ]] && last_success="$last"
    last="$(awk '/^fincloud_backup_last_duration_seconds /{print $2; exit}' "$target" 2>/dev/null || true)"
    [[ -n "$last" ]] && last_duration="$last"
    last="$(awk '/^fincloud_backup_last_size_bytes /{print $2; exit}' "$target" 2>/dev/null || true)"
    [[ -n "$last" ]] && last_size="$last"
  fi
  if [[ "$success" == "1" ]]; then
    last_success="$(date +%s)"
    last_duration="$duration"
    last_size="$size"
  fi

  local tmp="$target.tmp.$$"
  {
    echo "# HELP fincloud_backup_last_success_timestamp_seconds Unix timestamp of the last successful FinCloud backup."
    echo "# TYPE fincloud_backup_last_success_timestamp_seconds gauge"
    echo "fincloud_backup_last_success_timestamp_seconds $last_success"
    echo "# HELP fincloud_backup_last_attempt_success Whether the most recent backup attempt succeeded (1) or failed (0)."
    echo "# TYPE fincloud_backup_last_attempt_success gauge"
    echo "fincloud_backup_last_attempt_success $success"
    echo "# HELP fincloud_backup_last_duration_seconds Duration of the most recent successful backup."
    echo "# TYPE fincloud_backup_last_duration_seconds gauge"
    echo "fincloud_backup_last_duration_seconds $last_duration"
    echo "# HELP fincloud_backup_last_size_bytes Size of the most recent successful database dump."
    echo "# TYPE fincloud_backup_last_size_bytes gauge"
    echo "fincloud_backup_last_size_bytes $last_size"
  } > "$tmp" 2>/dev/null && mv -f "$tmp" "$target" 2>/dev/null || rm -f "$tmp" 2>/dev/null
  return 0
}

trap 'write_metrics 0 || true' ERR

command -v docker >/dev/null 2>&1 || die "Docker CLI tidak ditemukan di PATH."

log INFO "FinCloud backup dimulai. Output: $OUTPUT_ROOT"
log INFO "Database=$DATABASE | DbContainer=$DB_CONTAINER | Bucket=$BUCKET"

docker info >/dev/null 2>&1 || die "Docker daemon tidak berjalan."
container_running "$DB_CONTAINER" || die "Container '$DB_CONTAINER' tidak berjalan."
if [[ "$SKIP_STORAGE" -eq 0 ]]; then
  container_running "$STORAGE_CONTAINER" || die "Container '$STORAGE_CONTAINER' tidak berjalan."
fi

DUMP_TOOL="$(docker exec "$DB_CONTAINER" sh -c 'if command -v mariadb-dump >/dev/null 2>&1; then echo mariadb-dump; elif command -v mysqldump >/dev/null 2>&1; then echo mysqldump; else echo MISSING; fi')"
[[ "$DUMP_TOOL" != "MISSING" ]] || die "Tidak menemukan mariadb-dump/mysqldump di container."
log INFO "Tool dump: $DUMP_TOOL"

CLIENT_TOOL="$(docker exec "$DB_CONTAINER" sh -c 'if command -v mariadb >/dev/null 2>&1; then echo mariadb; elif command -v mysql >/dev/null 2>&1; then echo mysql; else echo MISSING; fi')"
[[ "$CLIENT_TOOL" != "MISSING" ]] || die "Tidak menemukan client mariadb/mysql di container."
log INFO "Client database: $CLIENT_TOOL"

PING_SCRIPT="MYSQL_PWD=\"\$MARIADB_ROOT_PASSWORD\" $CLIENT_TOOL -uroot \"$DATABASE\" -N -e \"SELECT 1\""
docker exec "$DB_CONTAINER" sh -c "$PING_SCRIPT" >/dev/null || die "Koneksi database '$DATABASE' gagal."
log INFO "Koneksi database '$DATABASE' OK."

if [[ "$DRY_RUN" -eq 1 ]]; then
  log OK "[DryRun] Preflight selesai. Tidak ada file yang dibuat."
  exit 0
fi

mkdir -p "$OUTPUT_ROOT"
STAMP="$(date +'%Y%m%d-%H%M%S')"
BACKUP_DIR="$OUTPUT_ROOT/$STAMP"
suffix=1
while [[ -e "$BACKUP_DIR" ]]; do
  BACKUP_DIR="$OUTPUT_ROOT/${STAMP}-${suffix}"
  suffix=$((suffix + 1))
done
mkdir -p "$BACKUP_DIR"
LOG_FILE="$BACKUP_DIR/backup.log"

log() {
  local level="$1"; shift
  local line
  line="$(printf '[%s] [%s] %s' "$(date +'%Y-%m-%d %H:%M:%S')" "$level" "$*")"
  printf '%s\n' "$line"
  printf '%s\n' "$line" >> "$LOG_FILE"
}

STARTED_AT="$(date +%s)"
log INFO "Folder backup: $BACKUP_DIR"

# ------------------------------------------------------------------ database
log INFO "Membuat dump database (single-transaction)..."
DUMP_SCRIPT="MYSQL_PWD=\"\$MARIADB_ROOT_PASSWORD\" $DUMP_TOOL -uroot --single-transaction --quick --routines --triggers --events --hex-blob --default-character-set=utf8mb4 \"$DATABASE\" > /tmp/fincloud_db.sql && gzip -9 -c /tmp/fincloud_db.sql > $TEMP_DB && rm -f /tmp/fincloud_db.sql"
docker exec "$DB_CONTAINER" sh -c "$DUMP_SCRIPT"
docker exec "$DB_CONTAINER" sh -c "gzip -t $TEMP_DB" || die "Verifikasi gzip dump gagal."
docker cp "$DB_CONTAINER:$TEMP_DB" "$BACKUP_DIR/fincloud_db.sql.gz" >/dev/null
docker exec "$DB_CONTAINER" rm -f "$TEMP_DB"

DB_SIZE="$(wc -c < "$BACKUP_DIR/fincloud_db.sql.gz" | tr -d ' ')"
DB_SHA="$(sha256_file "$BACKUP_DIR/fincloud_db.sql.gz")"
log OK "Dump database OK: $DB_SIZE bytes | SHA256 $DB_SHA"

COUNT_SQL="SELECT 'users' AS t, COUNT(*) AS c FROM users UNION ALL SELECT 'transactions', COUNT(*) FROM transactions UNION ALL SELECT 'categories', COUNT(*) FROM categories UNION ALL SELECT 'receipts', COUNT(*) FROM receipts UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs"
COUNT_SCRIPT="MYSQL_PWD=\"\$MARIADB_ROOT_PASSWORD\" $CLIENT_TOOL -uroot \"$DATABASE\" -N -e \"$COUNT_SQL\""
RAW_COUNTS="$(docker exec "$DB_CONTAINER" sh -c "$COUNT_SCRIPT")"

ROW_JSON=""
ROW_SUMMARY=""
while IFS=$'\t' read -r table count; do
  [[ -z "${table:-}" ]] && continue
  ROW_JSON+="\"$table\": ${count:-0},"
  ROW_SUMMARY+="${table}=${count:-0} "
done <<< "$RAW_COUNTS"
ROW_JSON="${ROW_JSON%,}"
log INFO "Row counts: $ROW_SUMMARY"

# ------------------------------------------------------------------- storage
STORAGE_INCLUDED="false"
STORAGE_SIZE="null"
STORAGE_SHA="null"
STORAGE_FILE="null"

if [[ "$SKIP_STORAGE" -eq 1 ]]; then
  log WARN "Backup MinIO dilewati (--skip-storage)."
else
  log INFO "Membuat arsip bucket MinIO..."
  command -v tar >/dev/null 2>&1 || die "Perintah 'tar' tidak ditemukan di host."
  BUCKET_EXISTS="$(docker exec "$STORAGE_CONTAINER" sh -c "test -d /data/$BUCKET && echo yes || echo no")"
  if [[ "$BUCKET_EXISTS" == "yes" ]]; then
    rm -rf "$BACKUP_DIR/$BUCKET"
    docker cp "$STORAGE_CONTAINER:/data/$BUCKET" "$BACKUP_DIR/$BUCKET" >/dev/null
    tar -czf "$BACKUP_DIR/receipts.tar.gz" -C "$BACKUP_DIR" "$BUCKET"
    tar -tzf "$BACKUP_DIR/receipts.tar.gz" >/dev/null || die "Verifikasi arsip MinIO gagal."
    rm -rf "$BACKUP_DIR/$BUCKET"

    STORAGE_INCLUDED="true"
    STORAGE_SIZE="$(wc -c < "$BACKUP_DIR/receipts.tar.gz" | tr -d ' ')"
    STORAGE_SHA="\"$(sha256_file "$BACKUP_DIR/receipts.tar.gz")\""
    STORAGE_FILE="\"receipts.tar.gz\""
    log OK "Arsip MinIO OK: $STORAGE_SIZE bytes | SHA256 $STORAGE_SHA"
  else
    log WARN "Bucket '$BUCKET' belum ada; backup storage dilewati."
  fi
fi

# ------------------------------------------------------------------ manifest
COMPLETED_AT="$(date +%s)"
DURATION=$((COMPLETED_AT - STARTED_AT))
CREATED_AT="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
HOSTNAME_VALUE="${HOSTNAME:-$(hostname 2>/dev/null || echo unknown)}"

cat > "$BACKUP_DIR/manifest.json" <<EOF
{
  "backupVersion": 1,
  "createdAt": "$CREATED_AT",
  "host": "$HOSTNAME_VALUE",
  "database": "$DATABASE",
  "dbContainer": "$DB_CONTAINER",
  "dbDumpTool": "$DUMP_TOOL",
  "dbDumpFile": "fincloud_db.sql.gz",
  "dbDumpSizeBytes": $DB_SIZE,
  "dbDumpSha256": "$DB_SHA",
  "storage": {
    "included": $STORAGE_INCLUDED,
    "bucket": "$BUCKET",
    "file": $STORAGE_FILE,
    "sizeBytes": $STORAGE_SIZE,
    "sha256": $STORAGE_SHA
  },
  "rowCounts": { $ROW_JSON },
  "retentionDays": $RETENTION_DAYS,
  "durationSeconds": $DURATION,
  "status": "success"
}
EOF

{
  printf '%s  %s\n' "$DB_SHA" "fincloud_db.sql.gz"
  if [[ "$STORAGE_INCLUDED" == "true" ]]; then
    printf '%s  %s\n' "$(sha256_file "$BACKUP_DIR/receipts.tar.gz")" "receipts.tar.gz"
  fi
} > "$BACKUP_DIR/SHA256SUMS.txt"

printf '%s' "$BACKUP_DIR" > "$OUTPUT_ROOT/last-backup.txt"

write_metrics 1 "$DURATION" "$DB_SIZE"

log OK "Backup selesai dalam ${DURATION} detik."

# ----------------------------------------------------------------- retention
if [[ "$RETENTION_DAYS" -gt 0 ]]; then
  while IFS= read -r -d '' olddir; do
    [[ "$olddir" == "$BACKUP_DIR" ]] && continue
    rm -rf "$olddir"
    log INFO "Backup lama dihapus: $(basename "$olddir")"
  done < <(find "$OUTPUT_ROOT" -mindepth 1 -maxdepth 1 -type d -name '20*-*' -mtime "+$RETENTION_DAYS" -print0)
else
  log INFO "Retensi dinonaktifkan (retention-days=0)."
fi

printf '\nBACKUP OK -> %s\n' "$BACKUP_DIR"

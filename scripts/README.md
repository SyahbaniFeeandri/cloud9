# FinCloud Backup & Recovery Scripts

Folder ini berisi otomasi backup dan restore untuk:

- **MariaDB** `fincloud_db` — dump konsisten (`--single-transaction`) berisi schema, data, routine, trigger, dan event.
- **MinIO** bucket `fincloud-receipts` — arsip struk pembayaran.

SOP lengkap: [`docs/23-sop-backup-recovery.md`](../docs/23-sop-backup-recovery.md).

> **Status terverifikasi (17 Nov 2026):** backup 4,46 detik, `VERIFY OK`,
> restore penuh 20,4 detik, data + struk kembali, E2E 78/78 lulus.
> Bukti: [`docs/24-backup-drill-report.md`](../docs/24-backup-drill-report.md).

---

## Prasyarat

- Docker Desktop / Docker Engine aktif.
- Stack FinCloud berjalan minimal service `mariadb` dan `minio`:
  ```powershell
  docker compose up -d mariadb minio
  ```
- PowerShell 5.1+ (Windows) atau Bash 4+ (Linux/macOS).
- Perintah `tar` tersedia di host (image MinIO tidak menyertakan `tar`/`gzip`;
  script menyalin direktori bucket dengan `docker cp` lalu mengarsipkannya di host).

> Di Linux/macOS, beri izin eksekusi sekali saja:
> `chmod +x scripts/backup.sh scripts/restore.sh`.

---

## Backup

```powershell
# Windows — backup DB + struk, retensi 7 hari
.\scripts\backup.ps1

# Simpan ke lokasi lain
.\scripts\backup.ps1 -OutputRoot D:\backups\fincloud -RetentionDays 14

# Hanya database
.\scripts\backup.ps1 -SkipStorage

# Cek prasyarat tanpa menulis file
.\scripts\backup.ps1 -DryRun
```

```bash
# Linux/macOS
./scripts/backup.sh
./scripts/backup.sh --output /var/backups/fincloud --retention-days 14
./scripts/backup.sh --skip-storage --dry-run
```

Output:

```text
backups/YYYYMMDD-HHMMSS/
├── fincloud_db.sql.gz
├── receipts.tar.gz        # kecuali -SkipStorage
├── manifest.json          # metadata + row counts + SHA-256
├── SHA256SUMS.txt
└── backup.log
```

`backups/last-backup.txt` menyimpan path backup terakhir.

---

## Verifikasi Backup (non-destruktif)

Restore dump ke database scratch `fincloud_restore_test`, bandingkan row count
dengan manifest, lalu hapus database scratch. Database produksi tidak disentuh.

```powershell
.\scripts\restore.ps1 -Latest -VerifyOnly
```

```bash
./scripts/restore.sh --latest --verify-only
```

---

## Restore

> **Peringatan:** restore menimpa data. Script otomatis membuat snapshot
> pra-restore dan melakukan rollback bila proses gagal.

```powershell
# Restore backup terbaru (DB + struk)
.\scripts\restore.ps1 -Latest -Force

# Restore folder tertentu, database saja
.\scripts\restore.ps1 -BackupPath .\backups\20261107-020000 -DatabaseOnly -Force

# Restore tanpa snapshot pra-restore (tidak disarankan)
.\scripts\restore.ps1 -Latest -Force -SkipPreBackup
```

```bash
./scripts/restore.sh --latest --force
./scripts/restore.sh --backup backups/20261107-020000 --database-only --force
```

---

## Penjadwalan

### Windows Task Scheduler

```powershell
# Setiap hari 02:00 (butuh PowerShell Administrator)
.\scripts\install-backup-task.ps1

# Jadwal lain
.\scripts\install-backup-task.ps1 -Time 01:30 -RetentionDays 14

# Hapus jadwal
.\scripts\install-backup-task.ps1 -Unregister
```

### Linux cron

```cron
0 2 * * * cd /opt/fincloud && BACKUP_DIR=/var/backups/fincloud ./scripts/backup.sh >> /var/log/fincloud-backup.log 2>&1
```

---

## Exit Code

| Code | Arti |
|---:|---|
| `0` | Sukses |
| `1` | Gagal (preflight, dump, checksum, restore, atau rollback) |

---

## Keamanan

- Backup berisi data pengguna dan hash password — **jangan commit** ke Git
  (`backups/` sudah masuk `.gitignore`).
- Simpan salinan offsite dan enkripsi (BitLocker/LUKS atau arsip terenkripsi).
- Script tidak menulis password ke log; kredensial dibaca dari environment
  container (`MARIADB_ROOT_PASSWORD`).

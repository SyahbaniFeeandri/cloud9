# SOP Backup & Disaster Recovery — FinCloud

> **Proyek**: FinCloud — Cloud-Based Financial Management & Monitoring Platform
> **Tim**: Cloud9
> **Pemilik proses**: Database & Infrastructure Engineer
> **Versi**: 1.1
> **Tanggal**: 7 November 2026 (revisi 17 November 2026)
> **Status**: Aktif

---

## 1. Tujuan

Dokumen ini menetapkan prosedur standar untuk:

1. Mencadangkan database MariaDB `fincloud_db` dan object storage MinIO bucket `fincloud-receipts` secara otomatis.
2. Memulihkan data setelah insiden kehilangan, korupsi, atau kegagalan infrastruktur.
3. Memverifikasi bahwa backup benar-benar dapat dipulihkan (bukan sekadar terbentuk).
4. Menjaga keamanan data pengguna yang terkandung di dalam backup.

SOP ini menjadi acuan pelaksanaan **Minggu 7 — Testing & Backup** dan simulasi
disaster recovery sebelum demo Minggu 8.

---

## 2. Ruang Lingkup & Aset yang Dilindungi

| Aset | Lokasi | Metode Backup | Prioritas |
|---|---|---|---|
| Database `fincloud_db` | Volume `cloud9-fincloudapp_mariadb_data` | `mariadb-dump` + gzip | **Kritis** |
| Struk pembayaran | Bucket MinIO `fincloud-receipts` | `tar` + gzip | **Tinggi** |
| Kode aplikasi & konfigurasi | Repositori Git | Git remote | Tinggi |
| Konfigurasi infra | `docker-compose.yml`, `infra/` | Git remote | Tinggi |
| Volume Prometheus/Grafana | `prometheus_data`, `grafana_data` | Tidak di-backup (reproducible) | Rendah |

Yang **tidak** termasuk backup otomatis: log container, cache, dan volume
monitoring. Dashboard Grafana dapat diprovision ulang dari `infra/grafana/`.

---

## 3. Target RPO & RTO

| Metrik | Target | Justifikasi |
|---|---|---|
| **RPO** (Recovery Point Objective) | **≤ 24 jam** | Backup harian 02:00 + salinan offsite mingguan |
| **RTO** (Recovery Time Objective) | **≤ 1 jam** | Restore teruji ke stack lokal |
| Retensi harian | **7 hari** | Cukup untuk mendeteksi kerusakan data beberapa hari kemudian |
| Retensi offsite | **4 minggu** | Rekomendasi; disimpan di storage terenkripsi terpisah |

Jika kebutuhan bisnis meningkat, jadwal dapat dinaikkan menjadi tiap 6 jam
dengan menambah trigger/cron.

---

## 4. Peran & Tanggung Jawab

| Peran | Tanggung jawab |
|---|---|
| **Database & Infrastructure Engineer** | Menjalankan/menjadwalkan backup, restore, dan drill |
| **DevOps & Container Engineer** | Memastikan Docker/host sehat, salinan offsite, akses storage |
| **QA & Integration Engineer** | Memverifikasi hasil restore (login, transaksi, struk, laporan) |
| **Project Manager** | Menyetujui restore produksi dan mencatat insiden |

Restore yang menimpa data produksi **wajib** diketahui minimal satu anggota
lain dan dicatat waktunya.

---

## 5. Prasyarat

1. Docker Desktop / Docker Engine aktif.
2. Container `fincloud-mariadb` dan `fincloud-minio` berjalan:
   ```powershell
   docker compose up -d mariadb minio
   docker compose ps
   ```
3. Ruang disk cukup (minimal 2× ukuran database + struk).
4. Script tersedia di `scripts/` dan dapat dieksekusi.
5. PowerShell 5.1+ (Windows) atau Bash 4+ (Linux/macOS).
6. Perintah `tar` tersedia di host (dipakai untuk mengarsipkan struk; image MinIO tidak menyertakan `tar`).

> **Catatan MariaDB 11.x**: binary dump bernama **`mariadb-dump`**, bukan
> `mysqldump`. Script mendeteksi otomatis keduanya, jadi tidak perlu diubah
> manual.

---

## 6. Lokasi & Struktur Backup

Default output: `backups/` di root repositori (sudah di-gitignore).

```text
backups/
├── 20261107-020000/
│   ├── fincloud_db.sql.gz      # dump database (schema + data + routine/trigger/event)
│   ├── receipts.tar.gz         # arsip bucket MinIO
│   ├── manifest.json           # metadata, row counts, SHA-256
│   ├── SHA256SUMS.txt
│   └── backup.log
├── 20261108-020000/
└── last-backup.txt             # path backup terakhir
```

Manifest memuat:

- timestamp, host, nama database, container, tool dump;
- ukuran dan SHA-256 setiap file;
- jumlah baris tabel `users`, `transactions`, `categories`, `receipts`, `audit_logs`;
- durasi dan status.

---

## 7. Jadwal & Retensi

| Aktivitas | Frekuensi | Waktu | Media |
|---|---|---|---|
| Backup otomatis | Harian | 02:00 | `backups/` lokal |
| Verifikasi backup | Harian (setelah backup) | 02:15 | Database scratch |
| Salinan offsite | Mingguan | Senin 03:00 | Storage terenkripsi terpisah |
| DR drill (restore penuh) | Bulanan | Minggu ke-1 | Environment uji |

Retensi lokal default **7 hari**. Backup yang lebih lama dihapus otomatis,
tetapi backup terbaru selalu dipertahankan. Retensi offsite diatur terpisah.

---

## 8. Prosedur Backup

### 8.1 Backup manual (Windows)

```powershell
# Database + struk, retensi 7 hari
.\scripts\backup.ps1

# Lokasi & retensi khusus
.\scripts\backup.ps1 -OutputRoot D:\backups\fincloud -RetentionDays 14

# Hanya database
.\scripts\backup.ps1 -SkipStorage

# Uji prasyarat tanpa menulis file
.\scripts\backup.ps1 -DryRun
```

### 8.2 Backup manual (Linux/macOS)

```bash
./scripts/backup.sh
./scripts/backup.sh --output /var/backups/fincloud --retention-days 14
./scripts/backup.sh --skip-storage --dry-run
```

### 8.3 Backup otomatis

**Windows Task Scheduler** (butuh PowerShell Administrator):

```powershell
.\scripts\install-backup-task.ps1
# Jadwal lain:
.\scripts\install-backup-task.ps1 -Time 01:30 -RetentionDays 14
# Hapus:
.\scripts\install-backup-task.ps1 -Unregister
```

**Linux cron** (contoh `/etc/cron.d/fincloud-backup`):

```cron
0 2 * * * root cd /opt/fincloud && BACKUP_DIR=/var/backups/fincloud ./scripts/backup.sh >> /var/log/fincloud-backup.log 2>&1
```

### 8.4 Yang dilakukan script

1. Preflight: Docker daemon, container, koneksi database, tool dump.
2. Dump database di dalam container dengan:
   `--single-transaction --quick --routines --triggers --events --hex-blob --default-character-set=utf8mb4`.
3. Kompresi gzip + uji integritas (`gzip -t`) **di dalam container**.
4. Salin ke host dengan `docker cp` (binary-safe).
5. Salin direktori bucket MinIO ke host dengan `docker cp`, lalu arsipkan dengan
   `tar czf` dan uji integritas (`tar -tzf`).
6. Hitung SHA-256 dan row counts; tulis `manifest.json` + `SHA256SUMS.txt`.
7. Tulis `last-backup.txt` dan jalankan retensi.

Password tidak dikirim melalui command line host; script membaca
`MARIADB_ROOT_PASSWORD` dari environment container.

---

## 9. Verifikasi Backup

Verifikasi **wajib** dilakukan minimal sekali sehari dan sebelum restore.

### 9.1 Verifikasi cepat (checksum & integritas)

```powershell
$backup = Get-Content .\backups\last-backup.txt
Get-Content "$backup\manifest.json"
Get-Content "$backup\SHA256SUMS.txt"
```

Script backup sudah menjalankan `gzip -t`; checksum diverifikasi ulang
otomatis saat restore.

### 9.2 Verifikasi restore non-destruktif

```powershell
.\scripts\restore.ps1 -Latest -VerifyOnly
```

```bash
./scripts/restore.sh --latest --verify-only
```

Prosedur ini:

1. Memverifikasi checksum.
2. Membuat database scratch `fincloud_restore_test`.
3. Mengimpor dump ke database scratch.
4. Membandingkan row count dengan `manifest.json`.
5. Menghapus database scratch.

Database produksi tidak disentuh. Hasil akhir harus `VERIFY OK`.

### 9.3 Kriteria lulus

- [ ] Folder backup berisi `fincloud_db.sql.gz`, `receipts.tar.gz`, `manifest.json`.
- [ ] `manifest.json` berstatus `success`.
- [ ] Checksum cocok.
- [ ] Row count hasil restore sama dengan manifest.
- [ ] Ukuran file wajar (tidak 0 byte / tidak jauh lebih kecil dari biasanya).

---

## 10. Prosedur Restore

> **Peringatan**: restore menimpa data. Script mewajibkan `-Force`/`--force`,
> membuat snapshot pra-restore, dan menyetop backend selama proses.

### 10.1 Restore backup terbaru (DB + struk)

```powershell
.\scripts\restore.ps1 -Latest -Force
```

```bash
./scripts/restore.sh --latest --force
```

### 10.2 Restore folder tertentu

```powershell
.\scripts\restore.ps1 -BackupPath .\backups\20261107-020000 -Force
```

### 10.3 Restore database saja / storage saja

```powershell
.\scripts\restore.ps1 -Latest -DatabaseOnly -Force
.\scripts\restore.ps1 -Latest -StorageOnly -Force
```

```bash
./scripts/restore.sh --latest --database-only --force
./scripts/restore.sh --latest --storage-only --force
```

### 10.4 Skenario insiden

#### Skenario A — Data transaksi terhapus / salah input massal

1. Hentikan penggunaan aplikasi (umumkan maintenance).
2. Jalankan `restore.ps1 -Latest -DatabaseOnly -Force`.
3. Verifikasi row count + login + daftar transaksi.
4. Jika struk tidak berubah, storage tidak perlu direstore.

#### Skenario B — Database korup / tidak bisa start

1. Cek log: `docker logs fincloud-mariadb --tail 100`.
2. Jika container tidak sehat, jalankan ulang: `docker compose up -d --force-recreate mariadb`.
3. Restore database: `restore.ps1 -Latest -DatabaseOnly -Force`.
4. Jika masih gagal, lakukan **total disaster** (Skenario D).

#### Skenario C — Struk hilang / bucket korup

1. Restore storage: `restore.ps1 -Latest -StorageOnly -Force`.
2. Buka salah satu transaksi dengan struk, pastikan presigned URL dapat diakses.
3. Pastikan akses anonymous tetap ditolak (403).

#### Skenario D — Total disaster / host baru

1. Siapkan host baru dengan Docker & Git.
2. Clone repositori dan buat `.env` dari `.env.example`.
3. Jalankan hanya infrastruktur penyimpanan:
   ```powershell
   docker compose up -d mariadb minio
   ```
4. Salin folder backup terbaru (dari offsite) ke `backups/`.
5. Restore penuh:
   ```powershell
   .\scripts\restore.ps1 -Latest -Force
   ```
6. Jalankan seluruh stack:
   ```powershell
   docker compose up -d
   ```
7. Verifikasi sesuai bagian 11.

#### Skenario E — Restore ke environment uji

Gunakan `-VerifyOnly` dengan `-TargetDatabase`:

```powershell
.\scripts\restore.ps1 -BackupPath .\backups\20261107-020000 -VerifyOnly -TargetDatabase fincloud_restore_uji
```

---

## 11. Verifikasi Pasca-Restore

Wajib dijalankan dan dicatat:

- [ ] `docker compose ps` — semua service `Up`.
- [ ] `GET http://localhost:5000/api/health` → `200`, database & storage `connected`.
- [ ] Row count `users`, `transactions`, `categories`, `receipts`, `audit_logs` cocok dengan manifest.
- [ ] Login `user@fincloud.local` dan `admin@fincloud.local` berhasil.
- [ ] Dashboard menampilkan transaksi terbaru.
- [ ] Daftar transaksi dapat difilter dan dipaginasi.
- [ ] Buka struk → presigned URL `200`; akses anonymous `403`.
- [ ] Laporan kategori & bulanan tampil.
- [ ] Upload struk baru berhasil.
- [ ] Prometheus target `fincloud-backend=up`; Grafana `ok`.

Jika salah satu gagal, jangan nyatakan restore selesai — lanjutkan ke rollback.

---

## 12. Rollback

Restore otomatis membuat snapshot **pra-restore** (kecuali `-SkipPreBackup`).
Jika restore gagal:

1. Script mencoba rollback otomatis ke snapshot pra-restore.
2. Backend dijalankan kembali.
3. Jika rollback otomatis gagal, jalankan manual:
   ```powershell
   .\scripts\restore.ps1 -BackupPath <snapshot-pra-restore> -Force -SkipPreBackup
   ```
4. Catat penyebab kegagalan dan buka tiket insiden.

Rollback tidak menghapus backup sumber; backup tetap tersedia untuk investigasi.

---

## 13. Keamanan Backup

Backup berisi data pribadi pengguna dan **hash password**:

- **Jangan commit** `backups/` ke Git (sudah di-gitignore).
- Batasi akses folder backup ke operator berwenang.
- Enkripsi at-rest (BitLocker/LUKS) dan enkripsi arsip offsite.
- Gunakan kanal terenkripsi (SFTP/HTTPS) untuk transfer offsite.
- Rotasi kredensial bila backup bocor.
- Jangan menulis password ke log; script membaca environment container.
- Simpan minimal satu salinan di lokasi geografis berbeda.

---

## 14. Monitoring & Notifikasi Kegagalan

Minimal sehari sekali periksa:

```powershell
# Umur backup terakhir
$last = Get-Content .\backups\last-backup.txt
Get-Item $last | Select-Object FullName, LastWriteTime
```

Rekomendasi otomasi:

- Cron/Task Scheduler mengirim email/webhook bila exit code ≠ 0.
- Alert bila `last-backup.txt` lebih tua dari 26 jam.
- Catat status backup di log operasional mingguan.

Kegagalan backup **tidak boleh** diabaikan lebih dari 48 jam.

---

## 15. DR Drill Checklist

Lakukan minimal sebulan sekali di environment uji.

| No | Langkah | Hasil diharapkan | Status |
|---:|---|---|:--:|
| 1 | Jalankan backup penuh | Folder + manifest terbentuk | ☑ |
| 2 | Jalankan `-VerifyOnly` | `VERIFY OK`, row count cocok | ☑ |
| 3 | Buat transaksi + upload struk uji | Data tersimpan | ☑ |
| 4 | Hapus transaksi & struk uji | Data hilang | ☑ |
| 5 | Restore penuh | Data & struk kembali | ☑ |
| 6 | Login user & admin | Berhasil | ☑ |
| 7 | Cek dashboard & laporan | Angka sesuai | ☑ |
| 8 | Cek presigned URL struk | `200`; anonymous `403` | ☑ |
| 9 | Cek health & monitoring | Semua sehat | ☑ |
| 10 | Ukur durasi restore | ≤ 1 jam (RTO) | ☑ |

> **Hasil drill 17 November 2026**: seluruh langkah lulus, restore penuh
> 20,4 detik. Detail bukti dan row count ada di
> [`docs/24-backup-drill-report.md`](24-backup-drill-report.md).

**Template laporan drill**

```text
Tanggal / operator :
Backup yang dipakai :
Ukuran DB / struk  :
Durasi backup      :
Durasi restore     :
Row count cocok    : ya / tidak
Kendala            :
Tindak lanjut      :
```

---

## 16. Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `Docker daemon tidak berjalan` | Docker Desktop belum start | Jalankan Docker Desktop, tunggu sampai `docker info` sukses |
| `Container 'fincloud-mariadb' tidak berjalan` | Stack belum up | `docker compose up -d mariadb minio` |
| `mariadb-dump: not found` | MariaDB 11 memakai nama baru | Script otomatis mendeteksi `mariadb-dump`; jangan hardcode `mysqldump` |
| Checksum tidak cocok | File backup korup / transfer tidak selesai | Jangan restore; buat backup baru, gunakan salinan offsite |
| Row count pasca-restore tidak cocok | Dump tidak lengkap / target salah | Periksa manifest, ulangi restore, rollback bila perlu |
| Backend tidak sehat setelah restore | Proses start belum selesai / env salah | `docker logs fincloud-backend --tail 100`, tunggu 60 detik |
| Task Scheduler gagal saat user logout | Task berjalan sebagai user interaktif | Gunakan service account atau cron di server Linux |
| Disk penuh saat backup | Retensi terlalu panjang | Perkecil `-RetentionDays`, pindahkan output ke disk lain |
| Restore ditolak | Belum memakai `-Force` | Tambahkan `-Force` setelah yakin |

---

## 17. Lampiran — Perintah Penting

```powershell
# Status stack
docker compose ps

# Backup & verifikasi
.\scripts\backup.ps1
.\scripts\restore.ps1 -Latest -VerifyOnly

# Restore penuh
.\scripts\restore.ps1 -Latest -Force

# Jadwal harian
.\scripts\install-backup-task.ps1

# Lihat manifest terakhir
$b = Get-Content .\backups\last-backup.txt; Get-Content "$b\manifest.json"

# Log MariaDB / backend
docker logs fincloud-mariadb --tail 100
docker logs fincloud-backend --tail 100

# Health check
Invoke-RestMethod http://localhost:5000/api/health
```

Dokumentasi script: [`scripts/README.md`](../scripts/README.md).

---

## 18. Riwayat Revisi

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 7 Nov 2026 | Dokumen awal: backup MariaDB + MinIO, restore, rollback, DR drill |
| 1.1 | 17 Nov 2026 | Hasil DR drill: backup 4,46 dtk, verify OK, restore 20,4 dtk (lulus) |

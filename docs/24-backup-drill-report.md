# Laporan DR Drill — Backup & Restore FinCloud

> **Proyek**: FinCloud — Cloud-Based Financial Management & Monitoring Platform
> **Tim**: Cloud9
> **Fokus**: Minggu 7 — Testing & Backup
> **Tanggal drill**: 17 November 2026, 15.29–15.31 WIB
> **Operator**: Database & Infrastructure Engineer (drill otomatis)
> **Status**: ✅ **LULUS** — backup, verifikasi, restore, dan verifikasi pasca-restore berhasil

---

## 1. Tujuan

Membuktikan bahwa backup harian FinCloud **benar-benar dapat dipulihkan**
(bukan sekadar terbentuk), mengukur durasi backup/restore terhadap target RTO,
dan menjalankan checklist DR drill pada
[`docs/23-sop-backup-recovery.md`](23-sop-backup-recovery.md) bagian 15.

---

## 2. Lingkungan Drill

| Komponen | Nilai |
|---|---|
| Host | Windows 11, Docker Desktop 29.9.3 (WSL2) |
| Stack | MariaDB 11, MinIO, backend, frontend, Nginx, Prometheus, Grafana, Loki |
| Database | `fincloud_db` |
| Bucket | `fincloud-receipts` |
| Script | `scripts/backup.ps1`, `scripts/restore.ps1` |
| Endpoint uji | `http://localhost:8080/api` |

---

## 3. Skenario

Simulasi kehilangan data setelah backup:

1. Buat transaksi uji `DRILL-<timestamp>` beserta struk PNG.
2. Jalankan backup penuh (database + bucket).
3. Verifikasi backup ke database scratch (`-VerifyOnly`).
4. Hapus transaksi dan struk uji → simulasi data hilang.
5. Restore penuh dari backup (`-Latest -Force`).
6. Pastikan transaksi dan struk kembali, lalu jalankan E2E.
7. Bersihkan data drill agar kembali ke baseline seed.

---

## 4. Hasil

### 4.1 Backup

| Item | Hasil |
|---|---|
| Backup path | `backups/20261117-152937` |
| Durasi | **4,46 detik** |
| Dump database | `fincloud_db.sql.gz` — 8,13 KB, SHA-256 `b91fa814…db8fb` |
| Arsip struk | `receipts.tar.gz` — 646 B, SHA-256 `93f7f99e…44d837` |
| Row counts | users=2, transactions=8, categories=14, receipts=1, audit_logs=594 |
| Status manifest | `success` |
| Retensi | 7 hari, tidak ada backup kedaluwarsa |

### 4.2 Verifikasi non-destruktif

```text
Checksum OK: fincloud_db.sql.gz
Checksum OK: receipts.tar.gz
Verifikasi restore database OK (row count cocok dengan manifest).
Verifikasi arsip MinIO OK.
VERIFY OK
```

Durasi total verifikasi: **6,6 detik**. Database produksi tidak disentuh.

### 4.3 Simulasi kehilangan data

Transaksi drill dan struknya dihapus melalui API:

```json
{ "id": 235, "receipt": 200, "tx": 200, "after": 404 }
```

`GET /api/transactions/235` → **404**, presigned URL struk → **404**.

### 4.4 Restore

| Item | Hasil |
|---|---|
| Backup sumber | `backups/20261117-152937` |
| Snapshot pra-restore | `backups/20261117-153016` (otomatis) |
| Durasi total restore | **20,4 detik** |
| Restore database | ✅ selesai |
| Restore bucket | ✅ selesai |
| Row count pasca-restore | ✅ cocok dengan manifest |
| Backend sehat | ✅ health check 200 |

Urutan restore sesuai SOP: checksum → snapshot pra-restore → stop backend
→ import database → ganti isi bucket → verifikasi row count → start backend.

### 4.5 Verifikasi pasca-restore

| Pemeriksaan | Hasil |
|---|---|
| `GET /api/health` | `UP`, database `connected`, storage `connected` |
| Transaksi drill kembali | **200**, deskripsi & nominal `77777.00` utuh |
| Presigned URL struk | **200** |
| Akses anonymous ke bucket | **403** |
| Login user & admin | ✅ berhasil |
| E2E suite | **78/78 PASS** |
| `docker compose ps` | 11 service `Up` |
| Prometheus targets | **4/4 UP** |
| Alert firing | **0** |
| Metrik container cAdvisor | 11 service |
| Data drill dibersihkan | ✅ baseline 6 transaksi, bucket kosong |

---

## 5. Evaluasi RPO / RTO

| Metrik | Target | Hasil drill | Status |
|---|---|---|---|
| RPO | ≤ 24 jam | Backup tepat sebelum simulasi (≈ 1 menit) | ✅ |
| RTO | ≤ 1 jam | **20,4 detik** (termasuk snapshot pra-restore & health check) | ✅ |
| Retensi | 7 hari | Aktif, belum ada yang kedaluwarsa | ✅ |

---

## 6. Checklist DR Drill (SOP §15)

| No | Langkah | Hasil diharapkan | Status |
|---:|---|---|:--:|
| 1 | Jalankan backup penuh | Folder + manifest terbentuk | ☑ |
| 2 | Jalankan `-VerifyOnly` | `VERIFY OK`, row count cocok | ☑ |
| 3 | Buat transaksi + upload struk uji | Data tersimpan | ☑ |
| 4 | Hapus transaksi & struk uji | Data hilang (404) | ☑ |
| 5 | Restore penuh | Data & struk kembali | ☑ |
| 6 | Login user & admin | Berhasil | ☑ |
| 7 | Cek dashboard & laporan | Angka sesuai (E2E lulus) | ☑ |
| 8 | Cek presigned URL struk | `200`; anonymous `403` | ☑ |
| 9 | Cek health & monitoring | Semua sehat, 4/4 target UP | ☑ |
| 10 | Ukur durasi restore | ≤ 1 jam (RTO) — 20,4 detik | ☑ |

---

## 7. Catatan & Tindak Lanjut

- Restore otomatis membuat snapshot pra-restore, sehingga kegagalan dapat
  di-rollback tanpa kehilangan kondisi terakhir.
- Drill dijalankan saat stack observability aktif; Prometheus, Grafana, dan
  Loki tetap berjalan selama restore backend.
- Docker Desktop pada host ini sempat restart sebelum drill dimulai
  (masalah lingkungan, lihat KI-05). Drill dijalankan setelah stack pulih dan
  tidak terganggu selama proses backup/restore.
- Rekomendasi: jalankan drill bulanan dan simpan salinan offsite terenkripsi
  sesuai SOP §13. Tambahkan alert umur backup > 26 jam pada monitoring
  (rencana Minggu 8).
- Setelah data drill dibersihkan, dibuat backup baseline baru
  `backups/20261117-153401` (6 transaksi, bucket kosong) agar
  `restore.ps1 -Latest` menunjuk ke kondisi bersih, bukan snapshot drill.

---

## 8. Kesimpulan

Backup dan restore FinCloud **terbukti berfungsi end-to-end**: backup terbentuk
dengan checksum valid, verifikasi non-destruktif lulus, data yang dihapus dapat
dipulihkan bersama struknya, dan seluruh pemeriksaan pasca-restore serta E2E
lulus. RTO aktual **20,4 detik**, jauh di bawah target 1 jam.

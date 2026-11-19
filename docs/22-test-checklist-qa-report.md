# Test Checklist & QA Report — FinCloud (Minggu 7)

> **Proyek**: FinCloud — Cloud-Based Financial Management & Monitoring Platform
> **Tim**: Cloud9
> **Fokus Minggu 7**: Testing & Backup
> **Disusun oleh**: Yasmin Akmaliyah — QA, Integration & Documentation Engineer
> **Tanggal pengujian**: 6 November 2026
> **Revisi**: 17 November 2026 — ditambah §10 Backup & Restore Drill
> **Versi dokumen**: 1.1
> **Status**: ✅ **LULUS** — seluruh pengujian otomatis dan checklist fungsional utama terpenuhi

---

## 1. Ringkasan Eksekutif

Pengujian Minggu 7 memverifikasi tiga lapisan utama FinCloud:

1. **Logika finansial** (surplus/defisit, rasio tabungan, rata-rata pengeluaran harian, arus kas bulanan).
2. **Validasi & CRUD transaksi** (create, read, update, delete, paginasi, normalisasi input).
3. **Alur end-to-end** `Login → Input Transaksi → Upload Struk → Cek Dashboard → Laporan → Hapus`, termasuk isolasi kepemilikan data antar-user, RBAC admin, dan pembersihan data uji.

### Hasil akhir

| Suite | Jumlah Tes / Check | Lulus | Gagal | Status |
|---|---:|---:|---:|---|
| Backend unit test (`backend/`) | 26 | 26 | 0 | ✅ PASS |
| Frontend unit test (`frontend/`) | 14 | 14 | 0 | ✅ PASS |
| End-to-end test (`tests/e2e/`) | 78 | 78 | 0 | ✅ PASS |
| **Total** | **118** | **118** | **0** | ✅ **PASS** |

Seluruh pengujian dijalankan terhadap stack Docker Compose yang aktif (MariaDB, MinIO, Backend, Frontend/Nginx, Prometheus, Grafana). Data uji E2E dibersihkan otomatis: setelah pengujian, database kembali berisi **6 transaksi seed** dan bucket MinIO **kosong**.

---

## 2. Lingkup Pengujian

### 2.1 In Scope

- Perhitungan finansial murni (tanpa DOM/database) pada frontend.
- Validasi payload transaksi dan normalisasi data pada backend.
- Operasi CRUD transaksi melalui REST API.
- Upload, akses, dan hapus struk melalui MinIO presigned URL.
- Alur pengguna end-to-end melalui Nginx (`http://localhost:8080`).
- Autentikasi JWT, RBAC (`USER` vs `ADMIN`), dan isolasi data antar-user.
- Dashboard, laporan kategori, dan laporan bulanan.
- Kesehatan stack monitoring (Prometheus + Grafana) setelah rebuild.
- Pembersihan data uji (idempotensi test run).

### 2.2 Out of Scope (Minggu 7, bukan bagian item D)

- **HA / Failure Simulation** (mis. matikan node, latensi jaringan) — backup & restore sudah diuji terpisah pada [drill Minggu 7](24-backup-drill-report.md).
- **Loki / centralized logging** — sudah diimplementasikan pada Minggu 6 (Loki + Promtail); pengujian LogQL mendalam belum termasuk laporan ini.
- Pengujian beban (load/stress test) dan pengujian keamanan penetrasi.
- Pengujian browser lintas perangkat secara manual (fokus pada API + logika).

---

## 3. Environment Pengujian

| Komponen | Versi / Konfigurasi |
|---|---|
| OS | Windows (host pengujian) |
| Node.js | v24.20.0 |
| npm | 11.19.0 |
| Docker | 29.9.2 |
| Docker Compose | v5.6.1 |
| Backend | Node.js 22 Alpine, Express 4, port `5000` |
| Database | MariaDB 11, database `fincloud_db` |
| Object Storage | MinIO, bucket privat `fincloud-receipts` |
| Frontend | Nginx Alpine, port `8080` |
| Monitoring | Prometheus `:9090`, Grafana `:3001` |
| Base URL E2E | `http://localhost:8080/api` (via Nginx) |
| Akun uji | `user@fincloud.local` / `admin@fincloud.local` (password `password123`) |

### Status container saat pengujian

| Service | Status |
|---|---|
| `backend` | Up |
| `frontend` | Up |
| `mariadb` | Up (healthy) |
| `minio` | Up |
| `prometheus` | Up |
| `grafana` | Up |

---

## 4. Strategi Pengujian

| Level | Tools | Tujuan |
|---|---|---|
| Unit test backend | `node --test` (built-in) | Menguji fungsi murni validasi transaksi tanpa DB |
| Unit test frontend | `node --test` (built-in) | Menguji kalkulasi finansial dan normalisasi store tanpa browser |
| End-to-end | Node.js `fetch` + `FormData` | Menguji alur nyata melalui API/Nginx terhadap stack berjalan |
| Smoke non-fungsional | `Invoke-WebRequest` / Prometheus API | Memastikan monitoring tetap sehat setelah rebuild |

Pendekatan ini **tidak menambah dependency baru**; seluruh tes memakai Node.js built-in test runner.

---

## 5. Hasil Unit Test Backend

**Perintah**: `cd backend; npm test`
**Hasil**: `tests 16 | pass 16 | fail 0`

| No | Nama Tes | Aspek yang Diuji | Status |
|---:|---|---|---|
| 1 | Security - Password hashing and verification | Hash & verifikasi password (bcrypt) | ✅ |
| 2 | Security - JWT token creation and verification | Pembuatan & verifikasi JWT | ✅ |
| 3 | Storage - canonical receipt URL keeps the bucket path | URL kanonik struk | ✅ |
| 4 | Storage - presigned URL contains a signature and the object key | Presigned URL + object key | ✅ |
| 5 | Storage - presigned URL rejects an empty key | Penolakan key kosong | ✅ |
| 6 | Transactions - accepts a complete valid create payload | Payload create valid | ✅ |
| 7 | Transactions - accepts numeric strings and normalizes ISO datetimes | Normalisasi nominal & tanggal | ✅ |
| 8 | Transactions - rejects missing or unknown type | Validasi tipe transaksi | ✅ |
| 9 | Transactions - rejects zero, negative, and non-numeric amounts | Validasi nominal | ✅ |
| 10 | Transactions - requires a category id or category name | Kewajiban kategori | ✅ |
| 11 | Transactions - rejects invalid and impossible dates | Validasi tanggal (termasuk 31 Feb) | ✅ |
| 12 | Transactions - parses amounts and dates safely | Parsing aman | ✅ |
| 13 | Transactions - partial update keeps existing values | Merge update parsial | ✅ |
| 14 | Transactions - partial update accepts a new amount and type | Update nominal & tipe | ✅ |
| 15 | Transactions - partial update rejects an invalid amount | Penolakan update tidak valid | ✅ |
| 16 | Transactions - pagination is clamped to safe bounds | Clamping `limit`/`offset` | ✅ |

**File terkait**:
- `backend/src/utils/transactionValidation.js`
- `backend/tests/transactions.test.js`
- `backend/tests/auth.test.js`
- `backend/tests/storage.test.js`

---

## 6. Hasil Unit Test Frontend

**Perintah**: `cd frontend; npm test`
**Hasil**: `tests 14 | pass 14 | fail 0`

### 6.1 Kalkulasi finansial (9 tes)

| No | Nama Tes | Aspek yang Diuji | Status |
|---:|---|---|---|
| 1 | Finance - surplus report calculates net savings and ratio | Surplus, net savings, rasio | ✅ |
| 2 | Finance - deficit report produces negative savings | Defisit & nilai negatif | ✅ |
| 3 | Finance - zero income avoids division by zero | Pembagian nol | ✅ |
| 4 | Finance - average daily expense respects the period length | Rata-rata harian per periode | ✅ |
| 5 | Finance - category ranking is sorted and percentages use rounded shares | Ranking & persentase kategori | ✅ |
| 6 | Finance - empty categories produce a zeroed report | Kondisi data kosong | ✅ |
| 7 | Finance - period days are inclusive and fall back to 30 for all time | Rentang hari inklusif | ✅ |
| 8 | Finance - monthly cashflow groups income and expense per month | Arus kas bulanan | ✅ |
| 9 | Finance - monthly cashflow ignores invalid dates and empty input | Data tanggal invalid | ✅ |

### 6.2 Store & normalisasi API (5 tes)

| No | Nama Tes | Aspek yang Diuji | Status |
|---:|---|---|---|
| 10 | Store - login persists the token and user | Persistensi sesi login | ✅ |
| 11 | Store - transactions are normalized for the views | Normalisasi transaksi & URL struk | ✅ |
| 12 | Store - dashboard numbers are converted to numbers | Konversi angka dashboard | ✅ |
| 13 | Store - resolveReceiptUrl keeps absolute URLs and prefixes relative ones | Resolusi URL struk | ✅ |
| 14 | Store - a 401 dispatches the unauthorized event | Penanganan sesi kedaluwarsa | ✅ |

**File terkait**:
- `frontend/js/finance.js` (logika murni, dipakai `reports.js`)
- `frontend/tests/finance.test.js`
- `frontend/tests/store.test.js`

---

## 7. Hasil End-to-End Test

**Perintah**: `node tests/e2e/transactions.e2e.mjs`
**Target**: `http://localhost:8080/api`
**Hasil**: **78 PASS / 0 FAIL**

### 7.1 Rincian per skenario

| Skenario | Jumlah Check | Lulus | Gagal |
|---|---:|---:|---:|
| Health check (API, database, storage) | 3 | 3 | 0 |
| Autentikasi & token | 8 | 8 | 0 |
| Reference data (kategori, dashboard, list) | 6 | 6 | 0 |
| Create & read transaksi | 6 | 6 | 0 |
| Upload struk & presigned URL | 9 | 9 | 0 |
| Update transaksi | 3 | 3 | 0 |
| Laporan kategori & bulanan | 3 | 3 | 0 |
| Hapus struk & transaksi | 4 | 4 | 0 |
| Isolasi kepemilikan antar-user | 5 | 5 | 0 |
| 20 variasi transaksi + verifikasi summary + hapus | 24 | 24 | 0 |
| Profil pengguna (get/update/restore) | 3 | 3 | 0 |
| RBAC endpoint admin | 3 | 3 | 0 |
| Logout | 1 | 1 | 0 |
| **Total** | **78** | **78** | **0** |

### 7.2 Bukti hasil penting

- Login `USER` dan `ADMIN` berhasil, role sesuai; login salah → **401**.
- Akses transaksi tanpa token / token invalid → **401**.
- Kategori tersedia: **14** (income + expense).
- Create transaksi → **201**, lalu dapat dibaca kembali dengan ID yang sama.
- Dashboard langsung memuat transaksi terbaru setelah create.
- Upload struk → **201**, mengembalikan presigned URL bertanda tangan (`X-Amz-Signature`).
- Presigned URL → **200** dengan `Content-Type: image/png`.
- Akses anonymous ke object bucket → **403** (bucket privat).
- Update transaksi mempertahankan deskripsi & nominal baru.
- Hapus struk → **200**; URL lama tidak lagi melayani file (**404**).
- Hapus transaksi → **200**; GET berikutnya → **404**.
- User tidak dapat membaca/mengubah/menghapus transaksi milik admin (**404**).
- 20 transaksi variasi berhasil dibuat, total summary income/expense **cocok persis** dengan perhitungan yang diharapkan, lalu dihapus satu per satu (**20/20**).
- Admin dapat membaca daftar user; user biasa → **403**; anonymous → **401**.
- Logout → **200**.

### 7.3 Pembersihan data

| Item | Kondisi akhir |
|---|---|
| Transaksi di database | **6** (kembali ke jumlah seed) |
| Object struk di MinIO | **0 file** |

E2E dapat dijalankan berulang tanpa meninggalkan data residu.

---

## 8. Test Checklist Fungsional

| No | Fitur / Skenario | Metode | Hasil | Catatan |
|---:|---|---|:--:|---|
| 1 | Login user valid | E2E | ✅ | Token JWT diterima |
| 2 | Login admin valid | E2E | ✅ | Role `ADMIN` |
| 3 | Login dengan password salah | E2E | ✅ | `401` |
| 4 | Akses API tanpa token | E2E | ✅ | `401` |
| 5 | Akses API dengan token invalid | E2E | ✅ | `401` |
| 6 | Registrasi akun baru | Manual/API | ✅ | Alur register tersedia di UI & API |
| 7 | Input transaksi pemasukan | E2E | ✅ | Tersimpan & tampil |
| 8 | Input transaksi pengeluaran | E2E | ✅ | Tersimpan & tampil |
| 9 | Validasi nominal nol/negatif/non-angka | Unit test | ✅ | Ditolak |
| 10 | Validasi tipe transaksi | Unit test | ✅ | Hanya `income`/`expense` |
| 11 | Validasi tanggal tidak mungkin | Unit test | ✅ | Mis. `2026-02-31` ditolak |
| 12 | Baca detail transaksi | E2E | ✅ | ID sesuai |
| 13 | Update transaksi | E2E | ✅ | Perubahan persisten |
| 14 | Hapus transaksi | E2E | ✅ | `404` setelah hapus |
| 15 | Upload struk (PNG) | E2E | ✅ | `201` + presigned URL |
| 16 | Akses struk via presigned URL | E2E | ✅ | `200`, `image/png` |
| 17 | Tolak akses anonymous ke bucket | E2E | ✅ | `403` |
| 18 | Hapus struk | E2E | ✅ | File tidak dapat diakses lagi |
| 19 | Dashboard memuat transaksi terbaru | E2E | ✅ | Data konsisten |
| 20 | Laporan kategori | E2E | ✅ | `200` |
| 21 | Laporan bulanan | E2E | ✅ | `monthlyStats` array |
| 22 | Perhitungan surplus/defisit | Unit test | ✅ | Termasuk nilai negatif |
| 23 | Rasio tabungan | Unit test | ✅ | Pembagian nol aman |
| 24 | Rata-rata pengeluaran harian | Unit test | ✅ | Sesuai panjang periode |
| 25 | Arus kas bulanan | Unit test | ✅ | Grouping per bulan |
| 26 | Isolasi data antar-user | E2E | ✅ | `404` untuk data user lain |
| 27 | RBAC admin | E2E | ✅ | User `403`, anonymous `401` |
| 28 | Paginasi transaksi | Unit + E2E | ✅ | `limit`/`offset` aman |
| 29 | Pembersihan data uji | E2E | ✅ | DB seed & bucket bersih |
| 30 | Monitoring tetap sehat | Smoke | ✅ | Lihat bagian 9 |

---

## 9. Pemeriksaan Non-Fungsional (Smoke)

Setelah rebuild image `backend` dan `frontend`:

| Pemeriksaan | Hasil | Status |
|---|---|:--:|
| `GET http://localhost:5000/metrics` | `200` | ✅ |
| Prometheus target `fincloud-backend` | `up` | ✅ |
| Prometheus target `prometheus` | `up` | ✅ |
| Prometheus target `node-exporter` | `up` | ✅ |
| Prometheus target `cadvisor` | `up` | ✅ |
| Alert rules termuat | `10` rules | ✅ |
| Loki siap menerima log (`/ready`) | `ready` | ✅ |
| Promtail mengirim log container | label `service` terisi | ✅ |
| Grafana health | `ok` | ✅ |
| Dashboard `FinCloud Overview` | `22` panel | ✅ |
| Dashboard `FinCloud Infrastructure & Containers` | `19` panel | ✅ |
| Dashboard `FinCloud Logs & Audit Trail` | `3` panel | ✅ |

Ini memastikan perubahan kode item D tidak merusak observability yang sudah ada,
dan melengkapi monitoring host/container serta log terpusat dari Minggu 6.

---

## 10. Backup & Restore Drill

Drill dijalankan 17 November 2026 terhadap stack aktif (detail bukti di
[`docs/24-backup-drill-report.md`](24-backup-drill-report.md)):

| Langkah | Hasil | Status |
|---|---|:--:|
| Backup penuh (DB + bucket) | `20261117-152937`, 4,46 detik | ✅ |
| Verifikasi non-destruktif (`-VerifyOnly`) | `VERIFY OK`, row count cocok | ✅ |
| Simulasi kehilangan transaksi + struk | `404` pada transaksi & URL struk | ✅ |
| Restore penuh (`-Latest -Force`) | 20,4 detik, snapshot pra-restore dibuat | ✅ |
| Data & struk kembali | transaksi `200`, struk `200`, anonymous `403` | ✅ |
| E2E setelah restore | 78/78 PASS | ✅ |
| Monitoring setelah restore | 4/4 target UP, 0 alert | ✅ |

RTO aktual **20,4 detik** (target ≤ 1 jam) dan RPO drill ≈ 1 menit
(target ≤ 24 jam). Data drill sudah dibersihkan; baseline kembali 6 transaksi.

---

## 11. Bug & Known Issues

Tidak ditemukan bug blocking pada lingkup item D. Catatan yang perlu diketahui:

| ID | Deskripsi | Tingkat | Dampak | Rencana |
|---|---|---|---|---|
| KI-01 | ~~Loki belum dijalankan~~ — **Selesai Minggu 6**: Loki + Promtail aktif, dashboard `FinCloud Logs & Audit Trail` tersedia | Info | Log terpusat sudah tersedia | ✅ Resolved |
| KI-02 | ~~Backup & Restore belum diuji~~ — **Selesai Minggu 7**: drill backup/restore lulus, restore 20,4 detik | Info | Backup terbukti dapat dipulihkan | ✅ Resolved |
| KI-03 | E2E membutuhkan stack Docker aktif | Info | Tidak bisa jalan di CI tanpa service | Dokumentasikan di `tests/e2e/README.md` |
| KI-04 | E2E membuat lalu menghapus data nyata | Rendah | Jika proses crash di tengah, data uji bisa tertinggal | Gunakan `RUN_ID` unik; cleanup best-effort |
| KI-05 | Docker Desktop (WSL2) kadang restart engine saat stack observability aktif | Info | Endpoint HTTP/HTTPS dan monitoring sempat tidak tersedia | Restart Docker Desktop lalu `docker compose up -d`; langkah ada di README |

---

## 12. Risiko & Rekomendasi

| Risiko | Mitigasi |
|---|---|
| Data uji tertinggal jika E2E terhenti paksa | Jalankan ulang E2E (cleanup berbasis token) atau bersihkan transaksi ber-prefix `E2E-` |
| Perbedaan environment lokal vs Docker | Selalu jalankan E2E terhadap `http://localhost:8080/api` setelah `docker compose up -d --build` |
| Regresi logika finansial | Pertahankan `frontend/tests/finance.test.js` sebagai gate sebelum merge |
| Regresi validasi API | Pertahankan `backend/tests/transactions.test.js` di pipeline |
| CI belum menjalankan service | Tambahkan job integrasi dengan `docker compose up -d` pada pipeline berikutnya |

---

## 13. Kesimpulan & Sign-off

Berdasarkan **118 pemeriksaan otomatis** (26 backend + 14 frontend + 78 E2E) yang seluruhnya lulus, serta smoke test monitoring (host, container, dan log terpusat) yang sehat, maka:

- Logika finansial FinCloud **terverifikasi** untuk kondisi surplus, defisit, data kosong, dan periode berbeda.
- Validasi & CRUD transaksi **berfungsi** dan tahan terhadap input tidak valid.
- Alur demo end-to-end `Login → Input Transaksi → Upload Struk → Cek Dashboard → Laporan → Hapus` **berjalan penuh**.
- Isolasi data antar-user dan RBAC **terbukti**.
- Data uji **dibersihkan** dan sistem kembali ke kondisi seed.

**Status akhir: ✅ LULUS — siap untuk demo Minggu 8.**

| Peran | Nama | Tanggal | Tanda tangan |
|---|---|---|---|
| QA & Integration Engineer | Yasmin Akmaliyah | 6 Nov 2026 | ✅ |
| Frontend Lead | Farelly DeRossi | — | ☐ |
| Backend/API Developer | Muhammad Farrel Gustiawan | — | ☐ |

---

## 14. Lampiran — Cara Menjalankan Ulang

```powershell
# 1. Pastikan stack aktif
docker compose up -d --build

# 2. Unit test backend (26 tes)
cd backend
npm test

# 3. Unit test frontend (14 tes)
cd ..\frontend
npm test

# 4. End-to-end (78 check)
cd ..
node tests/e2e/transactions.e2e.mjs

# Opsional: arahkan ke backend langsung
$env:FINCLOUD_BASE_URL = "http://localhost:5000/api"
node tests/e2e/transactions.e2e.mjs
```

### File pengujian

| Path | Fungsi |
|---|---|
| `backend/tests/auth.test.js` | Unit test keamanan (hash & JWT) |
| `backend/tests/cors.test.js` | Unit test allowlist CORS (Minggu 6) |
| `backend/tests/storage.test.js` | Unit test URL & presigned struk |
| `backend/tests/storage-prefix.test.js` | Unit test prefix `/storage` pada presigned URL (Item F) |
| `backend/tests/transactions.test.js` | Unit test validasi & CRUD transaksi |
| `backend/src/utils/transactionValidation.js` | Fungsi validasi murni |
| `frontend/tests/finance.test.js` | Unit test kalkulasi finansial |
| `frontend/tests/store.test.js` | Unit test store & normalisasi API |
| `frontend/js/finance.js` | Logika finansial murni |
| `tests/e2e/transactions.e2e.mjs` | Skenario end-to-end |
| `tests/e2e/README.md` | Panduan menjalankan E2E |

> **Catatan Item F (Reverse Proxy & Hardening):** suite backend bertambah 3 tes
> pada `storage-prefix.test.js` (total **19 tes**) untuk memverifikasi presigned
> URL melalui prefix `/storage`. Setelah migrasi Nginx edge dan `.env`, seluruh
> pengujian lulus: **19 backend + 14 frontend + 78 E2E**.
>
> **Catatan TLS (Minggu 5):** suite backend bertambah 2 tes untuk memverifikasi
> presigned URL mengikuti origin HTTP/HTTPS dari edge (total **21 tes**). E2E
> dijalankan terhadap `https://localhost:8443/api` (self-signed, verifikasi TLS
> dinonaktifkan khusus pengujian lokal) dan `http://localhost:8080/api`, seluruh
> **78 check** lulus pada kedua skema.
>
> **Catatan Keamanan & Observability (Minggu 6):** suite backend bertambah 5 tes
> `cors.test.js` untuk allowlist origin (total **26 tes**). Stack observability
> diperluas dengan **Node Exporter** (`9100`), **cAdvisor** (`8081`), **Loki**
> (`3100`), dan **Promtail**, disertai 5 alert host/container baru (total **10
> alert**) dan dashboard **Infrastructure & Containers** serta **Logs & Audit
> Trail**. Audit event kini ditulis ke `audit_logs` dan stdout terstruktur.

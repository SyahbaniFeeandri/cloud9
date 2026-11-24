# Dokumentasi Lengkap Proyek FinCloud (Cloud9)
**Cloud-Based Financial Management & Monitoring Platform**

---

## 1. Ringkasan Eksekutif (Executive Summary)

### 1.1 Gambaran Umum Proyek

**FinCloud** adalah platform manajemen dan monitoring keuangan pribadi/tim berbasis arsitektur *cloud-native*. Proyek ini dirancang untuk memberikan visibilitas penuh terhadap arus kas (*cash flow*), pencatatan transaksi masuk dan keluar, pengunggahan serta pengelolaan bukti transaksi (struk/invoice), analisis laporan keuangan interaktif, dan pemantauan kesehatan infrastruktur cloud secara *real-time*.

Proyek ini dikembangkan oleh tim **Cloud9** yang mencakup integrasi antara antarmuka web modern (*Single Page Application*), skema basis data relasional MariaDB, perancangan arsitektur kontainerisasi Docker, serta integrasi metrik Prometheus dan visualisasi Grafana.

### 1.2 Tim Pengembang

Berikut adalah susunan tim pengembang proyek FinCloud beserta branch kerja dan tanggung jawab perannya:

| No | Nama | Branch | Peran |
|:--:|---|---|---|
| 1 | **Muhammad Feeandri Syahbani** | `FeeandriDev` | Database Engineer & Cloud Security Engineer |
| 2 | **Arby Putra** | `ArbyDev` | Storage & Reliability Engineer |
| 3 | **Muhammad Farrel Gustiawan** | `BojongDev` | Backend/API Developer |
| 4 | **Yasmin Akmaliyah** | `YasminDev` | QA, Integration & Documentation Engineer |
| 5 | **Farelly DeRossi** | `BejekDev` | Frontend Lead |
| 6 | **Agustina Elsi Bunga** | `IraDev` | Cloud Infrastructure Engineer |
| 7 | **Kenjiro Boantua H.G** | `KenjiroDev` | DevOps & Container Engineer |
| 8 | **Ihsanul Farrel** | `ElloDev` | Monitoring & Logging Engineer |

---

## 2. Arsitektur Sistem & Direktori Proyek

### 2.1 Peta Direktori Repositori
```text
cloud9-fincloudApp/
├── backend/                  # REST API Express (JWT/RBAC, S3, metrik Prometheus)
│   ├── src/
│   │   ├── server.js         # Bootstrap Express, middleware, endpoint /metrics
│   │   ├── config/           # db.js, storage.js (MinIO/S3), metrics.js (prom-client)
│   │   ├── middleware/       # auth.js (JWT & RBAC), cors.js (allowlist origin)
│   │   ├── routes/           # auth, transactions, dashboard, reports, admin
│   │   └── utils/            # audit.js, transactionValidation.js
│   ├── tests/                # Unit test backend (node --test, 26 tes)
│   └── .env.example          # Template variabel lingkungan backend
├── Cloud9/                   # Lab kontainer Nginx dan MariaDB (webdb/webuser)
├── database/                 # Skema DDL dan data awal (seed) SQL untuk MariaDB
│   ├── schema.sql            # Definisi tabel (roles, users, categories, transactions, receipts, audit_logs)
│   └── seed.sql              # Inisialisasi peran, kategori, dan akun demo
├── docs/                     # Perencanaan, laporan QA, dan spesifikasi arsitektur
│   ├── 01-charter.md         # Piagam proyek (tujuan, timeline, scope)
│   ├── 04-branching-rules.md # Kebijakan git branching tim
│   ├── 05-erd-draft.md       # Diagram Relasi Entitas (ERD) dan relasi kunci
│   ├── 13-use-case.md        # Spesifikasi alur use case fungsional
│   ├── 21-notulen-minggu2.md # Notulen rapat minggu 2
│   ├── 22-test-checklist-qa-report.md # Laporan QA & checklist pengujian
│   ├── 23-sop-backup-recovery.md      # SOP backup, restore & disaster recovery
│   ├── 24-backup-drill-report.md      # Bukti pelaksanaan DR drill
│   ├── 25-infrastruktur-finansial-dan-komputasi-cloud.md # Infrastruktur finansial & cloud (+13 diagram)
│   ├── DOKUMENTASI_LENGKAP.md         # Dokumen ini
│   └── diagrams/             # Diagram arsitektur (.mmd & .md) dan ERD
├── frontend/                 # Aplikasi antarmuka pengguna web (SPA)
│   ├── index.html            # Entry point utama SPA (routing container, modal, layout)
│   ├── package.json          # Script serve lokal & unit test
│   ├── README.md             # Dokumentasi modul frontend
│   ├── css/                  # Arsitektur CSS modular berbasis variabel token
│   │   ├── variables.css     # Palet warna fintech, dark/light mode, typography
│   │   ├── base.css          # Reset, layout responsif (sidebar, topbar, container)
│   │   ├── components.css    # UI reusable (cards, badges, modals, form inputs, toasts)
│   │   ├── auth.css          # Desain hero & split-view login/register
│   │   ├── dashboard.css     # KPI metrics, canvas charts, recent transactions widget
│   │   ├── transactions.css  # Toolbar filter, tabel data, dropzone upload bukti
│   │   └── reports.css       # Ringkasan eksekutif, ranking kategori, print view (@media print)
│   ├── js/                   # Logika JavaScript ES6 modular
│   │   ├── config.js         # API base URL & storage keys (local dev / Docker)
│   │   ├── api.js            # HTTP client, JWT header, timeout & error handling
│   │   ├── store.js          # API-backed state store & cache in-memory
│   │   ├── router.js         # Client-side hash router (#/login, #/dashboard, dll)
│   │   ├── auth.js           # Penanganan autentikasi & demo quick-login (USER/ADMIN)
│   │   ├── dashboard.js      # Rendering chart canvas & widget health check
│   │   ├── transactions.js   # Operasi CRUD transaksi, pencarian, dan filtering
│   │   ├── reports.js        # Kalkulasi analitik, generator CSV & print report
│   │   ├── finance.js        # Kalkulasi finansial murni (cashflow, kategori, rasio)
│   │   └── app.js            # Initializer aplikasi, theme switch, toast notifications
│   └── tests/                # Unit test frontend (node --test, 14 tes)
├── infra/                    # Konfigurasi infrastruktur
│   ├── nginx/                # Reverse proxy HTTP :8080 + HTTPS :8443 & security headers
│   ├── prometheus/           # prometheus.yml + alert.rules.yml (10 alert)
│   ├── grafana/              # Provisioning datasource + 3 dashboard FinCloud
│   ├── loki/                 # loki-config.yml + promtail-config.yml (log terpusat)
│   └── node-exporter/        # Konfigurasi metrik host
├── scripts/                  # Otomasi backup/restore (.ps1 & .sh) + penjadwalan
├── tests/                    # End-to-end test (Node.js, 78 check)
├── backups/                  # Output backup (gitignored, jangan di-commit)
├── docker-compose.yml        # Definisi seluruh service stack
├── .env.example              # Template variabel lingkungan (copy ke .env)
└── README.md                 # Petunjuk cepat repositori
```

> Referensi method/path seluruh endpoint REST API tersedia di bagian
> **Ringkasan Endpoint REST API** pada [`README.md`](../README.md).

---

## 3. Fitur-Fitur Utama Aplikasi (Frontend Web)

### 3.1 Autentikasi Pengguna (`#/login` & `#/register`)
- **Split-Screen Glassmorphism**: Tampilan visual interaktif dengan ringkasan status operasional cloud.
- **Form Interaktif**: Validasi email, kekuatan password (*password strength indicator*), dan pencocokan konfirmasi password.
- **Demo Quick-Login (1-Klik)**:
  - *Login sebagai User*: Akun demo `user@fincloud.local` (Role: `USER`).
  - *Login sebagai Admin*: Akun demo `admin@fincloud.local` (Role: `ADMIN`).
- **Penyimpanan Sesi Aman**: JWT disimpan di `localStorage`, divalidasi masa berlakunya (`exp`), dan dilengkapi auto-redirect bila sesi belum terautentikasi.

### 3.2 Dashboard Finansial Dinamis (`#/dashboard`)
- **KPI Metric Cards**:
  - Saldo Bersih (*Net Balance*)
  - Total Pemasukan (*Income*)
  - Total Pengeluaran (*Expense*)
  - Rasio Tabungan (*Savings Rate %*)
- **Grafik Arus Kas (Canvas Bar Chart)**: Visualisasi tren pemasukan vs pengeluaran per bulan.
- **Grafik Distribusi Kategori (Canvas Donut Chart)**: Persentase alokasi belanja (kebutuhan pokok, sewa hunian, transportasi, edukasi, dsb).
- **Aktivitas Transaksi Terbaru**: Menampilkan data real-time dengan status badge tipe dan tombol preview cepat struk.
- **Widget Health Check Node Cloud**: Status live **REST API**, **MariaDB**, dan **MinIO Object Storage** yang diambil dari endpoint `/api/health`.

### 3.3 Manajemen Transaksi & Bukti Pembayaran (`#/transactions`)
- **Operasi CRUD Lengkap**:
  - Tambah transaksi pemasukan atau pengeluaran baru.
  - Ubah (*Edit*) nominal, kategori, tanggal, catatan, dan berkas struk.
  - Hapus (*Delete*) transaksi dengan konfirmasi modal yang aman.
- **Pencarian & Multi-Filter Real-Time**:
  - Filter berdasarkan tipe (*Semua / Pemasukan / Pengeluaran*).
  - Filter kategori dinamis sesuai ERD database.
  - Filter periode waktu (*Bulan Ini / Bulan Lalu / Semua*).
  - Pencarian instan berdasarkan deskripsi catatan.
- **Object Storage Bukti Pembayaran (MinIO S3)**:
  - Upload drag-and-drop file struk (gambar/PDF) ke bucket privat `fincloud-receipts` melalui AWS S3 SDK.
  - Metadata berkas tersimpan di tabel `receipts`.
  - Preview thumbnail instan sebelum disimpan.
  - **Modal Viewer Struk**: Menampilkan bukti pembayaran resolusi penuh dengan presigned URL dan opsi download.

### 3.4 Laporan Keuangan Komprehensif (`#/reports`)
- **Rangkuman Eksekutif**: Rata-rata pengeluaran harian, rasio tabungan, dan surplus bersih.
- **Visualisasi Ranking Kategori**: Progress bar persentase beban pengeluaran tertinggi.
- **Tabel Rekapitulasi Terstruktur**: Jumlah frekuensi transaksi, total nominal, dan alokasi persen.
- **Ekspor & Cetak**:
  - **Unduh CSV**: Ekspor seluruh riwayat transaksi ke format `.csv` kompatibel Microsoft Excel dan Google Sheets.
  - **Cetak Laporan / PDF**: Format cetak khusus (`@media print`) yang menghilangkan sidebar dan tombol kontrol, menghasilkan tata letak siap cetak atau disimpan sebagai PDF.

### 3.5 Personalisasi & Tema
- **Tema Gelap & Terang (Dark / Light Mode)**: Penggantian instan dengan adaptasi otomatis ke preferensi sistem operasi.

---

## 4. Desain Basis Data (MariaDB Data Model)

Sesuai dengan berkas skema [database/schema.sql](file:///c:/Users/Feeandri/cloud9-fincloudApp/database/schema.sql), basis data terdiri dari 6 entitas utama:

| Nama Tabel | Fungsi Utama | Kunci Asing (Foreign Keys) |
|---|---|---|
| `roles` | Menyimpan jenis hak akses (`ADMIN`, `USER`) | - |
| `users` | Akun pengguna terdaftar dan hash kata sandi | `role_id` -> `roles(id)` |
| `categories` | Master kategori transaksi pemasukan & pengeluaran | - |
| `transactions` | Log mutasi keuangan pengguna, nominal, jenis, dan tanggal | `user_id` -> `users(id)`, `category_id` -> `categories(id)` |
| `receipts` | Metadata file lampiran struk yang tersimpan di Object Storage | `transaction_id` -> `transactions(id)` |
| `audit_logs` | Catatan jejak audit aktivitas pengguna untuk kepatuhan & keamanan | `user_id` -> `users(id)` |

---

## 5. Panduan Menjalankan Program

### 5.1 Menjalankan Backend & Frontend secara Lokal (Tanpa Docker)

Aplikasi membutuhkan **MariaDB** (`127.0.0.1:3306`) dan **MinIO** (`127.0.0.1:9000`)
yang aktif. Paling mudah, jalankan keduanya lewat Docker dari root repositori
(pastikan `.env` root sudah disalin dari `.env.example`):

```powershell
docker compose up -d mariadb minio
```

**1. Jalankan backend terlebih dahulu**

```powershell
cd backend
Copy-Item .env.example .env    # sesuaikan kredensial DB/MinIO/JWT
npm install
npm run dev                    # API tersedia di http://localhost:5000/api
```

**2. Jalankan frontend**

```powershell
cd frontend
npm start                      # otomatis menjalankan npx serve . -l 3000
```

**3. Buka aplikasi**

- **`http://localhost:3000`**

`frontend/js/config.js` otomatis mengarah ke `http://localhost:5000/api` untuk
local dev dan ke `/api` (same-origin) saat dijalankan lewat Docker/Nginx.
Bucket `fincloud-receipts` dibuat otomatis oleh backend saat start.

### 5.2 Mengakses dari Perangkat Lain (HP, Tablet, Laptop Lain)

#### Opsi 1: Satu Jaringan Wi-Fi (LAN)
Gunakan IP lokal mesin host (komputer Anda), misalnya:
- **`http://<IP-Komputer-Anda>:3000`** (contoh: `http://192.168.1.10:3000`)

Pastikan backend juga dapat diakses dari perangkat tersebut (port `5000`) atau
gunakan stack Docker yang sudah menyatukan frontend + API di balik Nginx.

#### Opsi 2: Dari Luar Jaringan / Internet Publik (Tunneling)
Gunakan utility tunneling seperti **localtunnel**:
```powershell
npx localtunnel --port 3000
```
Buka URL publik yang dihasilkan (contoh: `https://flat-islands-see.loca.lt`) di browser perangkat Anda.

---

## 6. Lingkungan Kontainer Lab Cloud9 (Docker)

Folder `Cloud9/` berisi lab awal (Nginx + MariaDB) yang dipakai untuk latihan
kontainerisasi:

```powershell
cd Cloud9
docker compose up -d
```
- **Nginx Web Endpoint**: `http://localhost:8080` (HTTP saja)
- **MariaDB Database**: Port `3306` (Database: `webdb`, User: `webuser`)
- Menghentikan kontainer: `docker compose down`

> Untuk menjalankan **aplikasi FinCloud lengkap**, gunakan stack utama di root
> repositori (`docker compose up -d --build`). Stack ini memakai database
> `fincloud_db` (user `DB_USER` dari `.env`), bukan `webdb`, serta menyediakan
> edge Nginx HTTP (`8080`) dan HTTPS (`8443`). Sertifikat self-signed dibuat
> otomatis oleh service `certs` di `./infra/nginx/certs` (gitignored) saat
> `docker compose up` pertama kali. Ganti dengan sertifikat CA terpercaya untuk
> produksi.

### 6.1 Monitoring, Logging & Audit Trail

Stack observability berjalan otomatis bersama `docker compose up -d`:

| Komponen | Port (loopback) | Fungsi |
|---|---|---|
| Backend `/metrics` | `5000` | Metrik aplikasi (RED, transaksi, auth, DB/storage) |
| Node Exporter | `9100` | Metrik host CPU, memory, disk, network |
| cAdvisor | `8081` | Metrik per container (CPU, memory, filesystem) |
| Prometheus | `9090` | Scrape 4 job, TSDB 15 hari, 10 alert rules |
| Loki | `3100` | Agregasi log terpusat, retensi 7 hari |
| Promtail | internal | Mengirim log seluruh container ke Loki |
| Grafana | `3001` | Dashboard Overview, Infrastructure, Logs & Audit Trail |

Audit event ditulis ke tabel `audit_logs` dan stdout terstruktur
(`{"level":"audit",...}`) sehingga dapat dicari di Grafana melalui datasource
Loki. CORS backend memakai allowlist `CORS_ORIGINS`, dan security headers
diterapkan di edge Nginx.

Pada Docker 29+ yang memakai containerd image store, cAdvisor membaca container
melalui socket `/run/containerd` (namespace `moby`) dan socket Docker sengaja
tidak di-mount agar Docker factory tidak menghapus container dari cache setelah
resync. Label `service` diturunkan dari nama image agar dashboard tetap mudah
dibaca. Metrik disk host diambil dari `/` pada Linux biasa atau
`/mnt/docker-desktop-disk` pada Docker Desktop.

---

## 7. Pengujian & Quality Assurance

FinCloud memakai **Node.js built-in test runner** (`node --test`) sehingga tidak
ada dependency pengujian tambahan.

| Suite | Perintah | Jumlah | Status |
|---|---|---|---|
| Unit test backend | `cd backend` lalu `npm test` | 26 tes | PASS |
| Unit test frontend | `cd frontend` lalu `npm test` | 14 tes | PASS |
| End-to-end | `node tests/e2e/transactions.e2e.mjs` | 78 check | PASS |

Cakupan E2E: `Login → Input Transaksi → Upload Struk → Cek Dashboard → Laporan
→ Hapus`, ditambah isolasi kepemilikan antar-user, RBAC admin, dan 20 variasi
transaksi. Script membersihkan seluruh data uji secara otomatis. E2E
membutuhkan stack Docker yang aktif.

Rincian hasil, checklist fungsional, pengujian non-fungsional, serta known
issues ada di [`22-test-checklist-qa-report.md`](22-test-checklist-qa-report.md).

---

## 8. Backup & Disaster Recovery

Backup mencakup database **MariaDB** (`fincloud_db`) dan bucket **MinIO**
(`fincloud-receipts`) dalam satu perintah. Dump dibuat dengan
`--single-transaction`, lalu diarsipkan bersama checksum dan manifest.

```powershell
# Backup database + struk (retensi default 7 hari)
.\scripts\backup.ps1

# Cek prasyarat tanpa menulis file
.\scripts\backup.ps1 -DryRun

# Verifikasi backup ke database scratch (tanpa menyentuh data produksi)
.\scripts\restore.ps1 -Latest -VerifyOnly

# Restore backup terbaru (snapshot pra-restore + rollback otomatis bila gagal)
.\scripts\restore.ps1 -Latest -Force
```

Padanan Linux/macOS tersedia di `scripts/backup.sh` dan `scripts/restore.sh`.
Struktur hasil backup, jadwal, retensi, RPO/RTO, runbook insiden, dan
troubleshooting dijelaskan lengkap di:

- [`23-sop-backup-recovery.md`](23-sop-backup-recovery.md) — SOP backup & DR
- [`24-backup-drill-report.md`](24-backup-drill-report.md) — bukti DR drill
- [`25-infrastruktur-finansial-dan-komputasi-cloud.md`](25-infrastruktur-finansial-dan-komputasi-cloud.md) — infrastruktur finansial & komputasi cloud (13 diagram)
- [`../scripts/README.md`](../scripts/README.md) — referensi parameter script

> Folder `backups/` berisi data pengguna dan hash password sehingga sudah
> di-gitignore. Jangan pernah di-commit; simpan salinan offsite dan enkripsi.

---

## 9. Standar Pengembangan & Panduan Git

- **Branch Utama**:
  - `main`: Branch produksi siap rilis.
  - `develop`: Branch integrasi utama seluruh fitur tim.
- **Branch Fitur & Personal**:
  - Branch personal masing-masing anggota: `FeeandriDev`, `ArbyDev`, `BojongDev`, `YasminDev`, `BejekDev`, `IraDev`, `KenjiroDev`, `ElloDev`.
  - Format penamaan fitur opsional: `feature/<nama-fitur>`.
- **Prinsip Kontribusi**:
  - Selalu lakukan `git pull origin develop` sebelum membuat branch baru.
  - Selesaikan merge conflict dengan memverifikasi perubahan antar tim sebelum melakukan push.

# Dokumentasi Lengkap Proyek FinCloud (Cloud9)
**Cloud-Based Financial Management & Monitoring Platform**

---

## 1. Ringkasan Eksekutif (Executive Summary)

### 1.1 Gambaran Umum Proyek

**FinCloud** adalah platform manajemen dan monitoring keuangan pribadi/tim berbasis arsitektur *cloud-native*. Proyek ini dirancang untuk memberikan visibilitas penuh terhadap arus kas (*cash flow*), pencatatan transaksi masuk dan keluar, pengunggahan serta pengelolaan bukti transaksi (struk/invoice), analisis laporan keuangan interaktif, dan pemantauan kesehatan infrastruktur cloud secara *real-time*.

Proyek ini dikembangkan oleh tim **Cloud9** yang mencakup integrasi antara antarmuka web modern (*Single Page Application*), skema basis data relasional MariaDB, perancangan arsitektur kontainerisasi Docker, serta perencanaan integrasi metrik Prometheus dan visualisasi Grafana.

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
├── backend/                  # Dokumen spesifikasi API (RESTful endpoint, status draft & ringkasan)
├── Cloud9/                   # Lingkungan lab kontainer Nginx dan database MariaDB (docker-compose)
├── database/                 # Skema DDL dan data awal (seed) SQL untuk MariaDB
│   ├── schema.sql            # Definisi tabel (roles, users, categories, transactions, receipts, audit_logs)
│   └── seed.sql              # Inisialisasi peran dan kategori awal
├── docs/                     # Perencanaan dan spesifikasi arsitektur
│   ├── 01-charter.md         # Piagam proyek (tujuan, timeline, scope)
│   ├── 04-branching-rules.md # Kebijakan git branching tim
│   ├── 05-erd-draft.md       # Diagram Relasi Entitas (ERD) dan relasi kunci
│   └── 13-use-case.md        # Spesifikasi alur use case fungsional
├── frontend/                 # Aplikasi antarmuka pengguna web (Single Page Application modern)
│   ├── index.html            # Entry point utama SPA (routing container, modal, layout)
│   ├── package.json          # Script otomasi serve lokal
│   ├── css/                  # Arsitektur CSS modular berbasis variabel token
│   │   ├── variables.css     # Palet warna fintech, dark/light mode, typography
│   │   ├── base.css          # Reset, layout responsif (sidebar, topbar, container)
│   │   ├── components.css    # UI reusable (cards, badges, modals, form inputs, toasts)
│   │   ├── auth.css          # Desain hero & split-view login/register
│   │   ├── dashboard.css     # KPI metrics, canvas charts, recent transactions widget
│   │   ├── transactions.css  # Toolbar filter, tabel data, dropzone upload bukti
│   │   └── reports.css       # Ringkasan eksekutif, ranking kategori, print view (@media print)
│   └── js/                   # Logika JavaScript ES6 modular
│       ├── store.js          # Reactive state store, seed data, persistence localStorage
│       ├── router.js         # Client-side hash router (#/login, #/dashboard, dll)
│       ├── auth.js           # Penanganan autentikasi & demo quick-login (USER/ADMIN)
│       ├── dashboard.js      # Rendering chart canvas (Bar Chart & Donut Chart)
│       ├── transactions.js   # Operasi CRUD transaksi, pencarian, dan filtering
│       ├── reports.js        # Kalkulasi analitik, generator CSV & print report
│       └── app.js            # Initializer aplikasi, theme switch, toast notifications
├── infra/                    # Konfigurasi infrastruktur (Prometheus, Grafana, Loki, Nginx)
└── README.md                 # Petunjuk cepat repositori
```

---

## 3. Fitur-Fitur Utama Aplikasi (Frontend Web)

### 3.1 Autentikasi Pengguna (`#/login` & `#/register`)
- **Split-Screen Glassmorphism**: Tampilan visual interaktif dengan ringkasan status operasional cloud.
- **Form Interaktif**: Validasi email, kekuatan password (*password strength indicator*), dan pencocokan konfirmasi password.
- **Demo Quick-Login (1-Klik)**:
  - *Login sebagai User*: Simulasi akun `Feeandri` (Role: `USER`).
  - *Login sebagai Admin*: Akses penuh (Role: `ADMIN`).
- **Penyimpanan Sesi Aman**: Menggunakan `localStorage` terisolasi dengan auto-redirect bila sesi belum terautentikasi.

### 3.2 Dashboard Finansial Dinamis (`#/dashboard`)
- **KPI Metric Cards**:
  - Saldo Bersih (*Net Balance*)
  - Total Pemasukan (*Income*)
  - Total Pengeluaran (*Expense*)
  - Rasio Tabungan (*Savings Rate %*)
- **Grafik Arus Kas (Canvas Bar Chart)**: Visualisasi tren pemasukan vs pengeluaran per bulan.
- **Grafik Distribusi Kategori (Canvas Donut Chart)**: Persentase alokasi belanja (kebutuhan pokok, sewa hunian, transportasi, edukasi, dsb).
- **Aktivitas Transaksi Terbaru**: Menampilkan data real-time dengan status badge tipe dan tombol preview cepat struk.
- **Widget Health Check Node Cloud**: Pemantauan visual koneksi database MariaDB, MinIO Object Storage, dan Prometheus Engine.

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
- **Simulasi Object Storage Bukti Pembayaran (MinIO S3)**:
  - Fitur drag-and-drop unggah file struk (gambar/PDF).
  - Preview thumbnail instan sebelum disimpan.
  - **Modal Viewer Struk**: Menampilkan bukti pembayaran resolusi penuh dengan opsi download.

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

### 5.1 Menjalankan Frontend Web Lokal

1. Masuk ke direktori `frontend`:
   ```powershell
   cd frontend
   ```
2. Jalankan server lokal:
   ```powershell
   npm start
   ```
   *(Secara otomatis menjalankan `npx serve . -l 3000`)*
3. Akses aplikasi melalui browser di:
   - **`http://localhost:3000`**

### 5.2 Mengakses dari Perangkat Lain (HP, Tablet, Laptop Lain)

#### Opsi 1: Satu Jaringan Wi-Fi (LAN)
Gunakan IP lokal mesin host (komputer Anda):
- **`http://192.168.32.157:3000`**

#### Opsi 2: Dari Luar Jaringan / Internet Publik (Tunneling)
Gunakan utility tunneling seperti **localtunnel**:
```powershell
npx localtunnel --port 3000
```
Buka URL publik yang dihasilkan (contoh: `https://flat-islands-see.loca.lt`) di browser perangkat Anda.

---

## 6. Lingkungan Kontainer Lab Cloud9 (Docker)

Untuk menjalankan layanan backend lab Nginx dan basis data MariaDB:
```powershell
cd Cloud9
docker compose up -d
```
- **Nginx Web Endpoint**: `http://localhost:8080`
- **MariaDB Database**: Port `3306` (Database: `webdb`, User: `webuser`)
- Menghentikan kontainer: `docker compose down`

---

## 7. Standar Pengembangan & Panduan Git

- **Branch Utama**:
  - `main`: Branch produksi siap rilis.
  - `develop`: Branch integrasi utama seluruh fitur tim.
- **Branch Fitur & Personal**:
  - Branch personal masing-masing anggota: `FeeandriDev`, `ArbyDev`, `BojongDev`, `YasminDev`, `BejekDev`, `IraDev`, `KenjiroDev`, `ElloDev`.
  - Format penamaan fitur opsional: `feature/<nama-fitur>`.
- **Prinsip Kontribusi**:
  - Selalu lakukan `git pull origin develop` sebelum membuat branch baru.
  - Selesaikan merge conflict dengan memverifikasi perubahan antar tim sebelum melakukan push.

# FinCloud - Frontend Web Application

Aplikasi antarmuka pengguna (UI) modern berbasis web untuk **FinCloud (Cloud-Based Financial Management & Monitoring Platform)**.

Dibangun dengan HTML5 murni, Vanilla CSS modern (Glassmorphism, Dark/Light Mode, Vibrant Fintech Tokens), dan JavaScript modular ES6 tanpa dependensi pihak ketiga yang berat.

---

## 🚀 Fitur Utama

### 1. Halaman Autentikasi (`#/login` & `#/register`)
- Desain split-screen hero glassmorphism dengan KPI preview arus kas real-time.
- Tab switcher dinamis antara **Masuk (Login)** dan **Daftar Akun (Register)**.
- Validasi form interaktif (nama, email, password strength, match confirm password).
- **1-Klik Demo Quick Login** untuk pengujian langsung:
  - Masuk sebagai **USER** (Feeandri)
  - Masuk sebagai **ADMIN** (Administrator FinCloud)

### 2. Dashboard Finansial (`#/dashboard`)
- **Metric KPI Cards**: Total Saldo Bersih, Pemasukan, Pengeluaran, dan Rasio Tabungan.
- **Tren Arus Kas (Cash Flow Chart)**: Grafik batang interaktif canvas (Pemasukan vs Pengeluaran 6 bulan terakhir).
- **Distribusi Kategori (Donut Chart)**: Visualisasi porsi belanja kebutuhan, hunian, utilitas, dsb.
- **Transaksi Terbaru**: Daftar aktivitas keuangan terkini dengan badge kategori dan indikator lampiran struk.
- **Widget Alokasi Budget & Status Node Cloud**: Indikator koneksi MariaDB, MinIO Object Storage, dan Prometheus dari API health.

### 3. Halaman Transaksi (`#/transactions`)
- **Pencarian Real-Time**: Cari transaksi berdasarkan nama, catatan, atau kategori.
- **Filter Multi-Kriteria**:
  - Filter tipe: *Semua*, *Pemasukan*, *Pengeluaran*
  - Filter kategori: *Gaji, Bisnis, Investasi, Makanan, Transportasi, dsb.* (sesuai ERD `docs/05-erd-draft.md`)
  - Filter rentang waktu: *Bulan Ini*, *Bulan Lalu*, *Semua*
- **CRUD Penuh**:
  - Tambah transaksi baru & ubah transaksi yang sudah ada.
  - Hapus transaksi dengan dialog konfirmasi aman.
- **Upload Bukti Struk ke MinIO S3 (Nyata)**:
  - Area drag & drop file gambar/PDF struk.
  - Upload ke bucket privat via AWS S3 SDK di backend.
  - Preview thumbnail instan.
- **Modal Penampil Struk (Receipt Viewer)**:
  - Menampilkan bukti pembayaran resolusi penuh dengan opsi unduh berkas.
  - URL struk memakai presigned URL berumur terbatas dan di-refresh otomatis saat kedaluwarsa.
- **Paginasi Data**: Tampilan rapi dengan pengatur halaman.

### 4. Halaman Laporan Keuangan (`#/reports`)
- **Executive Summary Cards**: Total arus masuk, arus keluar, surplus bersih, rasio tabungan, dan rata-rata pengeluaran harian.
- **Pilihan Periode Laporan**: *Bulan Ini*, *Kuartal 4*, *Tahun 2026*, atau *Semua Waktu*.
- **Peringkat Pengeluaran per Kategori**: Progress bar persentase visual pengeluaran terbesar.
- **Tabel Rekapitulasi Komprehensif**: Rincian frekuensi transaksi, nominal, dan persentase alokasi.
- **Ekspor Data Instan**:
  - **Export CSV**: Unduh file `.csv` transaksi secara langsung untuk dibuka di Excel/Google Sheets.
  - **Cetak / PDF**: Stylesheet khusus cetak (`@media print`) untuk mencetak atau menyimpan laporan keuangan resmi berformat PDF tanpa elemen navigasi.

### 5. Pengaturan & Profil (`#/profile`)
- Kelola profil pengguna dan simulasi Role-Based Access Control (RBAC: USER / ADMIN).
- Status endpoint sistem monitoring cloud.

---

## 🛠️ Cara Menjalankan

### Opsi 1: Menjalankan dengan Local Dev Server (Disarankan)
1. Masuk ke direktori `frontend`:
   ```bash
   cd frontend
   npm start
   # atau
   npx serve . -p 3000
   ```
2. Pastikan backend berjalan di `http://localhost:5000/api` (lihat README root).
3. Buka browser di `http://localhost:3000`.

### Opsi 2: Menjalankan lewat Docker Compose
Dari root repositori:
```bash
docker compose up -d
```
Frontend tersedia di `https://localhost:8443` (HTTPS) atau
`http://localhost:8080` (HTTP) melalui Nginx edge terpusat.
Nginx mem-proxy `/api/` ke backend dan `/storage/` ke MinIO. Struk diambil
memakai presigned URL yang ditandatangani backend (`/storage/...` mengikuti
origin halaman), sehingga bucket tetap privat dan MinIO tidak perlu diekspos.

### Konfigurasi API Base URL
- Local dev (`:3000`): otomatis memakai `http://localhost:5000/api`.
- Docker/Nginx: otomatis memakai `/api` (same-origin).
- Override manual sebelum `app.js` dimuat:
  ```html
  <script>window.FINCLOUD_API_BASE = 'https://api.example.com/api';</script>
  ```

### Testing

Frontend memakai Node.js built-in test runner (`node --test`) tanpa dependency tambahan:

```bash
cd frontend
npm test     # 14 tes: kalkulasi finansial (finance.js) & store
```

---

## 📁 Struktur Direktori

```text
frontend/
├── index.html            # Halaman utama aplikasi (SPA Router Container)
├── package.json          # Script serve lokal & unit test
├── README.md             # Dokumentasi modul frontend
├── css/
│   ├── variables.css     # Design tokens, palette warna fintech, dark/light theme
│   ├── base.css          # Reset, layout core, sidebar, header sticky, animations
│   ├── components.css    # Reusable components (cards, buttons, tables, modals, toasts)
│   ├── auth.css          # Styling halaman Login & Register + hero banner
│   ├── dashboard.css     # Styling metriks KPI, grafik canvas, dan aktivitas terbaru
│   ├── transactions.css  # Toolbar filter, tabel transaksi, modal struk
│   └── reports.css       # Analisis laporan, progress bar kategori, print layout
├── js/                   # Logika JavaScript ES6 modular
│   ├── config.js         # API base URL & storage keys (local dev / Docker)
│   ├── api.js            # HTTP client, JWT header, timeout & error handling
│   ├── store.js          # API-backed state store & in-memory cache
│   ├── router.js         # Client-side hash routing (#/login, #/dashboard, dll)
│   ├── auth.js           # Kontrol form login/register & demo login
│   ├── dashboard.js      # Engine visualisasi chart canvas & KPI dashboard
│   ├── transactions.js   # Logika CRUD transaksi, pencarian, dan filtering
│   ├── reports.js        # Kalkulasi analitik laporan & generator CSV
│   ├── finance.js        # Kalkulasi finansial murni (cashflow, kategori, rasio)
│   └── app.js            # Inisialisasi utama, modal dialogs, dan switch theme
└── tests/                # Unit test (finance.test.js & store.test.js)
```

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
- **Widget Alokasi Budget & Status Node Cloud**: Indikator koneksi PostgreSQL, MinIO Object Storage, dan Prometheus.

### 3. Halaman Transaksi (`#/transactions`)
- **Pencarian Real-Time**: Cari transaksi berdasarkan nama, catatan, atau kategori.
- **Filter Multi-Kriteria**:
  - Filter tipe: *Semua*, *Pemasukan*, *Pengeluaran*
  - Filter kategori: *Gaji, Bisnis, Investasi, Makanan, Transportasi, dsb.* (sesuai ERD `docs/05-erd-draft.md`)
  - Filter rentang waktu: *Bulan Ini*, *Bulan Lalu*, *Semua*
- **CRUD Penuh**:
  - Tambah transaksi baru & ubah transaksi yang sudah ada.
  - Hapus transaksi dengan dialog konfirmasi aman.
- **Simulasi Upload Bukti Struk ke MinIO S3**:
  - Area drag & drop file gambar/PDF struk.
  - Preview thumbnail instan.
- **Modal Penampil Struk (Receipt Viewer)**:
  - Menampilkan bukti pembayaran resolusi penuh dengan opsi unduh berkas.
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
Masuk ke direktori `frontend`:
```bash
cd frontend
npm start
# atau
npx serve . -p 3000
```
Buka browser di `http://localhost:3000`.

### Opsi 2: Membuka Langsung File HTML
Karena menggunakan standard ES Modules, Anda dapat menjalankan static server sederhana atau membukanya via ekstensi *Live Server* di VS Code / Antigravity IDE.

---

## 📁 Struktur Direktori

```text
frontend/
├── index.html            # Halaman utama aplikasi (SPA Router Container)
├── package.json          # Script serve lokal
├── README.md             # Dokumentasi modul frontend
├── css/
│   ├── variables.css     # Design tokens, palette warna fintech, dark/light theme
│   ├── base.css          # Reset, layout core, sidebar, header sticky, animations
│   ├── components.css    # Reusable components (cards, buttons, tables, modals, toasts)
│   ├── auth.css          # Styling halaman Login & Register + hero banner
│   ├── dashboard.css     # Styling metriks KPI, grafik canvas, dan aktivitas terbaru
│   ├── transactions.css  # Toolbar filter, tabel transaksi, modal struk
│   └── reports.css       # Analisis laporan, progress bar kategori, print layout
└── js/
    ├── store.js          # Central state & localStorage persistence (data seed Indonesia)
    ├── router.js         # Client-side hash routing (#/login, #/dashboard, dll)
    ├── auth.js           # Kontrol form login/register & demo login
    ├── dashboard.js      # Engine visualisasi chart canvas & KPI dashboard
    ├── transactions.js   # Logika CRUD transaksi, pencarian, dan filtering
    ├── reports.js        # Kalkulasi analitik laporan & generator CSV
    └── app.js            # Inisialisasi utama, modal dialogs, dan switch theme
```

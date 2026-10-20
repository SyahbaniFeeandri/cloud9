# Use Case Diagram FinCloud

**Owner:** Farelly (Frontend Lead)  
**Status:** Draft v1 — perlu review Backend Lead & PM sebelum merge  
**Catatan:** Diagram dibuat dengan Mermaid (native render di GitHub/GitLab). Mermaid tidak punya tipe use case resmi, jadi dipakai flowchart dengan notasi aktor dan oval.

---

## 1. Aktor

| Aktor | Deskripsi | Hak Akses |
|---|---|---|
| Guest | Pengunjung yang belum login | Register, Login |
| USER | Pengguna terautentikasi (role USER) | Dashboard, Transaksi, Report, Upload, Profil |
| ADMIN | Pengelola sistem (role ADMIN) | Kelola User, Audit Log, Status Sistem (+ akses fitur USER untuk akunnya sendiri) |

---

## 2. Daftar Use Case

### Guest

| ID | Use Case | Deskripsi |
|---|---|---|
| UC-01 | Register | Membuat akun baru (nama, email, password) |
| UC-02 | Login | Masuk dengan email + password, menerima token/session |

### USER

| ID | Use Case | Deskripsi |
|---|---|---|
| UC-03 | Lihat Dashboard | Ringkasan saldo, pemasukan/pengeluaran, grafik, transaksi terbaru |
| UC-04 | Kelola Transaksi | Tambah, lihat, ubah, hapus transaksi (CRUD) |
| UC-05 | Filter & Cari Transaksi | Filter berdasarkan tanggal, kategori, tipe |
| UC-06 | Lihat Report | Laporan keuangan per periode (harian/bulanan) |
| UC-07 | Export Report | Unduh report (CSV/PDF) |
| UC-08 | Upload File | Upload bukti/struk transaksi ke cloud storage |
| UC-09 | Kelola File Upload | Lihat, unduh, hapus file yang sudah diupload |
| UC-10 | Kelola Profil | Lihat & ubah data profil, ganti password |
| UC-11 | Logout | Mengakhiri sesi |

### ADMIN

| ID | Use Case | Deskripsi |
|---|---|---|
| UC-12 | Kelola User | Lihat daftar user, ubah role, aktif/nonaktifkan, hapus |
| UC-13 | Lihat Audit Log | Melihat jejak aktivitas (siapa, apa, kapan) + filter |
| UC-14 | Lihat Status Sistem | Health check API, database, storage, versi aplikasi |

---

## 3. Use Case Diagram

> Gambar diagram utama: `docs/diagrams/usecase-fincloud.png`

**Keterangan notasi:**
- Garis solid = aktor terhubung ke use case.
- include = use case wajib memanggil use case lain.
- extend = fungsi tambahan opsional.

---

## 4. Diagram per Aktor (Lebih Detail)

### 4.1 Guest

```mermaid
flowchart LR
    Guest((Guest)) --> Register
    Guest --> Login
    Register -.->|setelah sukses| Login
```

### 4.2 USER

```mermaid
flowchart LR
    USER((USER)) --> Dashboard
    USER --> Transaksi
    USER --> Report
    USER --> Upload
    USER --> Profil

    Dashboard --> T1[Tambah]
    Transaksi --> T2[Lihat / Filter]
    Transaksi --> T3[Ubah]
    Transaksi --> T4[Hapus]

    Report --> R1[Pilih Periode]
    Report --> R2[Export]

    Upload --> U1[Upload Bukti]
    Upload --> U2[Lihat / Hapus File]

    Profil --> P1[Ubah Data]
    Profil --> P2[Ganti Password]
```

### 4.3 ADMIN

```mermaid
flowchart LR
    ADMIN((ADMIN)) --> KelolaUser[Kelola User]
    ADMIN --> AuditLog[Audit Log]
    ADMIN --> StatusSistem[Status Sistem]

    KelolaUser --> K1[Lihat Daftar User]
    KelolaUser --> K2[Ubah Role]
    KelolaUser --> K3[Aktif / Nonaktifkan]
    KelolaUser --> K4[Hapus User]

    AuditLog --> A1[Filter by User / Aksi / Tanggal]

    StatusSistem --> S1[Health API]
    StatusSistem --> S2[Health Database]
    StatusSistem --> S3[Health Storage]
```

---

## 5. User Flow

### 5.1 Alur Utama (End-to-End)

Register -> Login -> Dashboard -> Transaksi -> Report -> Upload -> Admin

### 5.2 Flow Register & Login (Detail)

```mermaid
sequenceDiagram
    actor Guest
    participant FE as Frontend
    participant BE as Backend API
    participant DB as Database

    Guest->>FE: Isi form register
    FE->>FE: Validasi client-side
    FE->>BE: POST /auth/register
    BE->>DB: Simpan user (password di-hash)
    DB-->>BE: OK
    BE-->>FE: 201 Created
    FE-->>Guest: Redirect ke Login

    Guest->>FE: Isi form login
    FE->>BE: POST /auth/login
    BE->>DB: Cek kredensial
    DB-->>BE: User + role
    BE-->>FE: 200 + token
    FE->>FE: Simpan token, baca role
    FE-->>Guest: Redirect Dashboard (USER) / Admin (ADMIN)
```

### 5.3 Flow Transaksi

```mermaid
flowchart TD
    A[Dashboard] --> B[Menu Transaksi]
    B --> C[Daftar Transaksi]

    C --> D[Klik Tambah]
    C --> E[Klik Item]

    D --> F[Isi form: tipe, nominal, kategori, tanggal, catatan]
    F --> G{Lampirkan bukti?}
    G -->|Ya| H[Upload Bukti]
    G -->|Tidak| I[Simpan]
    H --> I

    I --> J{Validasi OK?}
    J -->|Tidak| K[Error di Field]
    J -->|Ya| L[Toast Sukses]

    E --> M[Ubah atau Hapus]
    M --> N{Konfirmasi Hapus?}
    N -->|Ya| C
    N -->|Tidak| C

    L --> C
```

### 5.4 Flow Admin

```mermaid
flowchart TD
    A[Login sebagai ADMIN] --> B[Guard: Cek role = ADMIN]
    B -->|Bukan ADMIN| C[403 / Redirect Dashboard]
    B -->|ADMIN| D[Menu Admin]

    D --> E[Kelola User]
    D --> F[Audit Log]
    D --> G[Status Sistem]

    E --> E1[Daftar User]
    E1 --> E2[Ubah Role / Status]
    E1 --> E3[Hapus User]
    E2 --> LOG[(Tercatat di Audit Log)]
    E3 --> LOG

    F --> F1[Filter User / Aksi / Tanggal]
    G --> G1[API / DB / Storage: OK atau Down]
```

---

## 6. Route & Akses

| Halaman | Route (Usulan) | Guest | USER | ADMIN |
|---|---|---|---|---|
| Landing | / | Ya | Ya | Ya |
| Register | /register | Ya | - | - |
| Login | /login | Ya | - | - |
| Dashboard | /dashboard | Tidak | Ya | Ya |
| Transaksi | /transactions | Tidak | Ya | Ya |
| Report | /reports | Tidak | Ya | Ya |
| Upload | /uploads | Tidak | Ya | Ya |
| Profil | /profile | Tidak | Ya | Ya |
| Kelola User | /admin/users | Tidak | Tidak | Ya |
| Audit Log | /admin/audit-logs | Tidak | Tidak | Ya |
| Status Sistem | /admin/system | Tidak | Tidak | Ya |

---

## 7. Update Wireframe

| Halaman | Perlu Wireframe | Status | Catatan |
|---|---|---|---|
| Register | Ya | Belum | Field: nama, email, password, konfirmasi password |
| Login | Ya | Belum | Link ke Register, pesan error |
| Dashboard | Ya | Belum | Kartu ringkasan, grafik, transaksi terbaru |
| Daftar Transaksi | Ya | Belum | Filter + tabel + pagination |
| Form Transaksi | Ya | Belum | Tambah/ubah, slot lampiran bukti |
| Report | Ya | Belum | Pilih periode, grafik, tombol export |
| Upload | Ya | Belum | Dropzone, daftar file, hapus |
| Profil | Ya | Belum | Ubah data, ganti password |
| Admin: Kelola User | Ya | Belum | Tabel user, ubah role/status |
| Admin: Audit Log | Ya | Belum | Tabel log + filter |
| Admin: Status Sistem | Ya | Belum | Indikator API/DB/Storage |
| State kosong / loading / error | Ya | Belum | Semua halaman |

---

## 8. Asumsi & Poin yang Perlu Dikonfirmasi ke Tim

- [ ] Backend: Apakah ada fitur forgot/reset password? (belum dimasukkan)
- [ ] Backend: Format export report — CSV, PDF, atau keduanya?
- [ ] Backend: Batas tipe & ukuran file upload (mis. jpg/png/pdf, maks 5 MB)?
- [ ] Backend: Apakah ADMIN boleh punya transaksi sendiri (diasumsikan ya)?
- [ ] DevOps: Endpoint status sistem apa yang dipakai (mis. /health)?
- [ ] PM: Apakah ada fitur tambahan (budget, kategori kustom, notifikasi) yang belum masuk?

---

## 9. Catatan untuk Reviewer

- Cek kesesuaian use case dengan requirement di `docs/02-requirements.md`.
- Pastikan semua role (Guest, USER, ADMIN) terwakili.
- Pastikan route di section 6 konsisten dengan wireframe.
- Konfirmasi poin-poin di section 8 sebelum merge.
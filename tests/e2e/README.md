# FinCloud End-to-End Test

Script ini menguji alur transaksi lengkap terhadap stack FinCloud yang sedang
berjalan (Docker Compose atau local dev).

## Cakupan

- Health check backend, MariaDB, dan MinIO.
- Login user & admin, login gagal, token tidak valid.
- CRUD transaksi: create, read, update, delete.
- Upload struk PNG, presigned URL, dan penolakan akses anonymous.
- Dashboard memuat transaksi terbaru.
- Laporan kategori & laporan bulanan.
- Isolasi kepemilikan data antara dua user.
- RBAC endpoint admin.
- 20 variasi transaksi (income/expense, nominal, kategori, tanggal).
- Cleanup otomatis seluruh data uji.

## Menjalankan

Pastikan stack sudah aktif:

```powershell
docker compose up -d
```

Lalu dari root repositori:

```powershell
node tests/e2e/transactions.e2e.mjs
```

Default base URL: `http://localhost:8080/api` (melalui Nginx).

Untuk menguji backend langsung:

```powershell
$env:FINCLOUD_BASE_URL = "http://localhost:5000/api"
node tests/e2e/transactions.e2e.mjs
```

Exit code `0` berarti semua pemeriksaan lulus; `1` berarti ada kegagalan.

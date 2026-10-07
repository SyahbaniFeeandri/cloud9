# Project Charter FinCloud

## Informasi Umum
- Judul: FinCloud: Cloud-Based Financial Management and Monitoring Platform
- Jenis: Mini-project kelompok
- Anggota: 9 mahasiswa
- Durasi: 8 minggu

## Tujuan
1. Membangun prototype aplikasi keuangan pribadi berbasis web
2. Menerapkan containerization Docker
3. Menerapkan PostgreSQL dan MinIO
4. Menerapkan JWT, RBAC, secret management
5. Menerapkan monitoring (Prometheus + Grafana)
6. Mendemonstrasikan backup & recovery

## Scope
In scope: registrasi, login, transaksi, dashboard, report, upload, admin, docker, monitoring
Out of scope: integrasi bank, mobile native, transaksi riil

## Timeline 8 Minggu
| Minggu | Fokus | Output |
|---|---|---|
| 1 | Requirement & planning | Charter, repo, board |
| 2 | Architecture design | Use case, ERD, API spec |
| 3 | Core app | Prototype v0.1 |
| 4 | Financial features | Prototype v0.2 |
| 5 | Deployment | docker compose up |
| 6 | Security & monitoring | Prototype v0.4 |
| 7 | Testing & backup | Test report |
| 8 | Final & demo | Deliverable final |

## Kriteria Keberhasilan
Alur demo end-to-end berjalan.

## Risiko
| Risiko | Level | Mitigasi |
|---|---|---|
| Kontribusi tidak merata | Tinggi | Project board, commit rutin |
| Kebocoran credential | Tinggi | .gitignore, env var |
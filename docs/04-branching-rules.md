# Branching Rules (Update)

## Struktur Branch
- `main`: Branch stabil, hanya menerima merge dari `develop`.
- `develop`: Branch integrasi harian.
- `[Nama]Dev`: Branch personal masing-masing anggota.
  - Contoh: FeeandriDev, ArbyDev, KenjiroDev, YasmineDev, dll.

## Aturan Kerja
1. Setiap anggota HANYA boleh push ke branch pribadinya masing-masing.
2. DILARANG push langsung ke `main` atau `develop`.
3. Setiap pagi, lakukan `git pull origin develop` di branch pribadi.
4. Setelah selesai mengerjakan tugas, push ke branch pribadi, lalu buat Pull Request (PR) ke `develop`.
5. PR wajib di-review minimal 1 orang sebelum di-merge.
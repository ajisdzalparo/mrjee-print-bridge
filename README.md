# Mrjee Print Bridge

Free, local-first silent printing bridge untuk aplikasi POS, WMS, ERP, dan web.

## Download

Unduh installer terbaru melalui halaman **Releases**. Source code desktop tidak
didistribusikan melalui repository ini.

## Fitur

- PDF, RAW, ZPL, SBPL, ESC/POS, dan image printing
- Logical printer mapping
- Unlimited local print jobs
- CORS allowlist dan bearer token
- System tray dan Windows auto-start
- Berjalan offline tanpa license key

## Mulai

1. Install `Mrjee Print Bridge Setup 1.0.0.exe`.
2. Buka Settings dan buat secret bearer token.
3. Tambahkan origin aplikasi web ke CORS allowlist.
4. Buat logical printer mapping.
5. Kirim request ke `http://localhost:9000/api/print`.

Dokumentasi lengkap tersedia di website resmi.

## Dukungan

Laporkan bug melalui GitHub Issues dengan versi Windows, versi Bridge, jenis
printer, langkah reproduksi, dan pesan error. Jangan pernah mengirim bearer
token atau isi dokumen print.

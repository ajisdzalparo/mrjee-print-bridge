# Mrjee Print Bridge

Free, local-first silent printing bridge untuk aplikasi POS, WMS, ERP, dan web
di Windows. Versi 1.0.0 dapat digunakan tanpa akun dan tanpa license key.

## Download

Unduh installer terbaru melalui halaman **Releases** repository ini. Source code
desktop tidak didistribusikan melalui repository public.

## Fitur

- PDF, RAW, ZPL, SBPL, ESC/POS, dan image printing
- Logical printer mapping
- Unlimited local print jobs
- CORS allowlist dan bearer token
- System tray dan Windows auto-start
- Notifikasi versi baru tanpa menghentikan print
- Berjalan offline tanpa license key

## Mulai cepat

1. Install `Mrjee Print Bridge Setup 1.0.0.exe`.
2. Jalankan Bridge dan pilih printer Windows yang ingin digunakan.
3. Gunakan menu test print untuk memastikan koneksi printer bekerja.
4. Buat logical printer mapping untuk integrasi aplikasi.

Demo test print dapat digunakan tanpa bearer token. Untuk integrasi aplikasi
production:

1. Buka Settings dan buat bearer token yang kuat.
2. Tambahkan origin aplikasi web ke CORS allowlist.
3. Kirim request terautentikasi ke `http://localhost:9000/api/print`.

Dokumentasi lengkap tersedia di website resmi.

## Verifikasi installer

Bandingkan SHA-256 installer dengan nilai pada
`checksums-v1.0.0.txt`. Installer saat ini belum ditandatangani dengan
code-signing certificate sehingga Windows SmartScreen mungkin menampilkan
peringatan.

## Privasi

Print job diproses secara lokal dan tidak dikirim ke cloud oleh Bridge. Jangan
membuka port lokal Bridge ke internet.

## Dukungan

Laporkan bug melalui GitHub Issues dengan versi Windows, versi Bridge, jenis
printer, langkah reproduksi, dan pesan error. Jangan pernah mengirim bearer
token atau isi dokumen print.

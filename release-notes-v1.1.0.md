## Mrjee Print Bridge v1.1.0

Pembaruan besar untuk Demo Print dan local printer playground.

### Playground dan format
- Custom payload Base64 PDF, ZPL, SBPL, ESC/POS, RAW text, dan Base64 image.
- Auto-detect format berdasarkan tipe mapping printer yang aktif.
- Payload editor dan contoh bawaan dari website resmi.
- Batas payload Demo sebesar 2 MB.

### Printer dan history
- Demo hanya menampilkan printer mapping berstatus Aktif.
- Request langsung ke printer Nonaktif ditolak.
- Printer tetap diverifikasi terhadap daftar printer Windows yang terpasang.
- Hasil Demo Print sukses atau gagal masuk ke Queues dan history desktop secara realtime.

### CORS default
- Domain resmi `mrjeeprint.com` dan `www.mrjeeprint.com`.
- Local development pada port 3000, 3100, dan 5173.
- Konfigurasi lama dimigrasikan tanpa menghapus origin custom milik pengguna.

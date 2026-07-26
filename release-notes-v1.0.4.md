## Mrjee Print Bridge v1.0.4

Perbaikan akses Demo Print dari website resmi Mrjee.

### Perubahan
- Mengizinkan trial printing dari `https://mrjeeprint.com`.
- Mengizinkan trial printing dari `https://www.mrjeeprint.com`.
- Menghapus domain demo lama `https://print.mrjee.id` dari whitelist.
- Proteksi loopback tetap aktif sehingga demo hanya dapat mencetak melalui Bridge pada komputer pengguna sendiri.
- Label versi pada footer desktop kini mengikuti versi aplikasi yang terpasang.
- Versi pada koneksi WebSocket tidak lagi menggunakan angka hardcoded.

### Catatan instalasi
Pengguna v1.0.3 perlu memperbarui Bridge ke v1.0.4 agar halaman Demo Print di mrjeeprint.com dapat memperoleh daftar printer dan menjalankan test print.

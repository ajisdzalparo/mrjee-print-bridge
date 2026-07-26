## Mrjee Print Bridge v1.0.6

Perbaikan kontrol printer pada Demo Print.

### Perubahan
- Halaman Demo hanya menerima printer dengan mapping berstatus Aktif.
- Printer Nonaktif tidak lagi muncul pada daftar printer Demo.
- Endpoint Demo Print menolak request langsung ke printer Nonaktif.
- Daftar tetap dicocokkan dengan printer Windows yang benar-benar terpasang.
- Print dari website Demo kini tercatat di Queues dan riwayat desktop.
- Hasil sukses atau gagal dikirim ke UI secara realtime melalui WebSocket.

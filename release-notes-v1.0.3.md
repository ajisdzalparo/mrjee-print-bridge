## Mrjee Print Bridge v1.0.3

Pembaruan kompatibilitas untuk SDK NPM `@mrjee-org/mj-multiple-printer@2.0.0`.

### Perubahan

- Menambahkan endpoint bertoken `GET /api/integration/printers`.
- Memungkinkan SDK mengambil daftar printer Windows secara aman.
- Mempertahankan endpoint dan fungsi printing yang sudah ada.
- Memperbaiki banner update yang tetap muncul setelah aplikasi selesai diperbarui.
- Status update dari cache kini dihitung ulang terhadap versi aplikasi yang sedang berjalan.

### Catatan instalasi

Installer Windows belum memakai sertifikat code-signing komersial. Windows SmartScreen mungkin menampilkan peringatan penerbit tidak dikenal. Unduh hanya dari website atau GitHub Release resmi Mrjee Print Bridge.

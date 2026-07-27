## Mrjee Print Bridge v2.0.0

Pembaruan privacy-first untuk memahami penggunaan Bridge tanpa mengganggu local printing.

### Telemetry anonim dan opt-in
- Pengguna baru menentukan sendiri apakah ingin mengirim statistik anonim.
- Persetujuan dapat diubah kapan saja melalui Settings.
- Telemetry mencatat versi aplikasi, format print, konfigurasi printer, serta status print berhasil atau gagal.
- Payload, dokumen, bearer token, nama printer, logical name, dan identitas perusahaan tidak dikirim.
- Printing tetap berjalan normal ketika telemetry ditolak, internet terputus, atau layanan analytics tidak tersedia.

### Transparansi
- Pilihan consent menjelaskan data yang dikirim dan tidak dikirim.
- Anonymous Usage Analytics tersedia di Application & Server Settings.
- Event desktop dipisahkan dari traffic website dengan parameter `event_source=desktop`.

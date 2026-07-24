# Publishing v1.0.0

1. Buat repository GitHub publik bernama `mrjee-print-bridge`.
2. Push isi repository ini.
3. Buat release baru dengan tag `v1.0.0`.
4. Gunakan `release-notes-v1.0.0.md` sebagai deskripsi.
5. Upload dari folder `release/`:
   - `Mrjee Print Bridge Setup 1.0.0.exe`
6. Upload `checksums-v1.0.0.txt`.
7. Atur environment website:
   - `GITHUB_REPOSITORY=USERNAME/mrjee-print-bridge`
   - `MINIMUM_BRIDGE_VERSION=1.0.0`
   - `UPDATE_SEVERITY=optional`
   - `UPDATE_MESSAGE=Versi baru tersedia...`
8. Deploy website lalu uji `/download`.
   Pastikan `https://mrjee.id/api/update` mengembalikan manifest JSON sebelum
   installer v1.0.0 diumumkan ke publik.
9. Daftarkan domain ke Google Search Console.
10. Submit `/sitemap.xml`.

Jangan upload source repository `mrjee-print-bridge-commercial`.

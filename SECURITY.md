# Security Policy

Laporkan kerentanan secara privat ke `security@mrjee.id`. Jangan membuka issue
publik sebelum perbaikan tersedia.

Mrjee Print Bridge tidak mengirim isi print job ke cloud. Pengguna tetap wajib:

- memakai bearer token yang panjang dan acak;
- membatasi CORS ke origin yang dipercaya;
- tidak mempublikasikan port Bridge ke jaringan publik;
- mengunduh installer hanya dari website atau GitHub Release resmi.

## Mrjee Print Bridge v1.2.1

Patch reliability untuk PDF printing pada printer thermal dengan driver Windows resmi.

### Perbaikan PDF native
- Payload `type: "pdf"` selalu menggunakan pipeline native Chromium PDFium dan Windows GDI.
- Nama printer seperti SATO atau Zebra tidak lagi memaksa PDF menjadi RAW SBPL/ZPL.
- Driver Windows resmi menangani konversi dokumen ke bahasa printer.
- RAW rasterization tetap tersedia jika developer meminta `type: "sbpl"` atau `type: "zpl"` secara eksplisit.
- Menghilangkan penyebab spooler Windows menampilkan status `Error - Not Accessible`.

### Pencegahan cetak ganda
- Native Chromium printing kini hanya dipanggil satu kali untuk setiap job PDF.
- `pdf-to-printer` hanya digunakan sebagai fallback jika native Chromium printing gagal.

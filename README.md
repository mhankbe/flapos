# FLa POS System — Cara Install & Jalankan

## Kebutuhan
- Node.js v18+ (download: https://nodejs.org)
- Tidak perlu install apapun lagi selain Node.js

## Cara Install

1. Extract ZIP ke folder mana saja
2. Buka terminal / command prompt di folder tersebut
3. Jalankan:

```bash
npm install
npm start
```

4. Buka browser → http://localhost:3000

## Default Password

| Role | Password |
|------|----------|
| 📊 Admin Pembukuan | admin123 |
| 📋 Admin Absensi | absensi123 |
| 📦 Admin Gudang | gudang123 |
| 👤 Absen Karyawan | (tidak perlu password) |

Password bisa diganti dari menu Settings (login sebagai Admin Pembukuan).

## Struktur Folder

```
flapos/
├── server.js          ← Server utama
├── database.js        ← Setup database SQLite
├── package.json
├── data/
│   └── flapos.db      ← Database (otomatis dibuat)
├── uploads/
│   ├── foto-karyawan/ ← Foto referensi wajah karyawan
│   └── foto-absensi/  ← Foto absensi harian
├── public/
│   └── index.html     ← Frontend utama
└── routes/
    ├── auth.js
    ├── karyawan.js
    ├── absensi.js
    ├── produk.js
    ├── stok.js
    ├── transaksi.js
    ├── rekap.js
    └── settings.js
```

## Data Tidak Hilang
- Semua data tersimpan di `data/flapos.db` (SQLite)
- Foto disimpan di `uploads/`
- Backup cukup copy folder `data/` dan `uploads/`

## Face Recognition
- Saat tambah karyawan → upload foto wajah sebagai referensi
- Saat karyawan absen → upload selfie → sistem bandingkan otomatis
- Threshold kecocokan: >45% diterima, <45% ditolak

## Akses dari HP Karyawan
1. Pastikan HP dan PC/server di WiFi yang sama
2. Cari IP address PC: jalankan `ipconfig` (Windows) atau `ifconfig` (Mac/Linux)
3. Karyawan buka browser HP → http://[IP-PC]:3000
4. Pilih "Absen Saya" → tidak perlu password

## Export Excel
- Login sebagai Admin Pembukuan
- Buka tab Rekap → pilih periode → Download .xlsx
- File berisi 8 sheet: Ringkasan, Transaksi, Detail Penjualan, Produk, Kartu Stok, Karyawan, Absensi, Slip Gaji

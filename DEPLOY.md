# Deploy FLa POS ke Render (GRATIS!)

## 🚀 Step-by-Step Deploy

### 1. Install Render CLI (opsional) atau pakai Dashboard Web

Cara termudah: pakai Dashboard Web di https://dashboard.render.com

### 2. Buat Akun Render
- Buka https://render.com
- Sign up dengan GitHub / Email
- Verifikasi email

### 3. Deploy via Blueprint (Paling Mudah!)

Render support **Blueprint** dari file `render.yaml` yang sudah dibuat.

**Opsi A: Deploy via Dashboard (Recommended)**

1. Push project ini ke **GitHub Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/flapos.git
   git push -u origin main
   ```

2. Buka https://dashboard.render.com/blueprints

3. Click **"New Blueprint Instance"**

4. Connect ke GitHub repo kamu

5. Render akan otomatis baca `render.yaml` dan deploy:
   - Web Service (Node.js)
   - PostgreSQL Database (Free tier)

### 4. Deploy Manual (Tanpa GitHub)

Kalau mau deploy langsung tanpa GitHub:

1. **Create PostgreSQL Database**:
   - Dashboard → New → PostgreSQL
   - Name: `flapos-db`
   - Region: Singapore
   - Plan: Free
   - Copy **Internal Database URL**

2. **Create Web Service**:
   - Dashboard → New → Web Service
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Environment Variables:
     - `DATABASE_URL`: (paste dari step 1)
     - `NODE_ENV`: `production`

### 5. Verifikasi Deploy

Setelah deploy selesai:
- URL akan muncul di dashboard
- Buka URL di browser
- Default password admin:
  - **Admin Pembukuan**: `admin123`
  - **Admin Absensi**: `absensi123`
  - **Admin Gudang**: `gudang123`

## ⚠️ Catatan Penting (Free Tier)

### Limitations Gratis:
- **Web Service**: Sleep setelah 15 menit idle (wake up ~30 detik)
- **Database**: 1GB storage, 100MB RAM
- **Bandwidth**: 100GB/bulan
- **Build**: 500 menit/bulan

### Tips:
1. Database tidak akan sleep (always on)
2. Upload gambar akan persist karena pakai disk mount
3. Data PostgreSQL backup otomatis

## 🔧 Troubleshooting

### Error: "Cannot connect to database"
- Pastikan `DATABASE_URL` environment variable sudah set
- Cek database status di dashboard

### Build Error
- Pastikan `package.json` ada `start` script
- Cek Node.js version compatible

### App Sleep
- Normal untuk free tier
- First request setelah sleep akan lambat (~30 detik)

## 📝 Environment Variables

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ Yes |
| `NODE_ENV` | `production` | ✅ Yes |
| `PORT` | `10000` | Auto-set by Render |

## 🎉 Selesai!

Setelah deploy berhasil, kamu punya POS System yang running di cloud GRATIS!

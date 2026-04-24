const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/karyawan', require('./routes/karyawan'));
app.use('/api/absensi', require('./routes/absensi'));
app.use('/api/produk', require('./routes/produk'));
app.use('/api/stok', require('./routes/stok'));
app.use('/api/transaksi', require('./routes/transaksi'));
app.use('/api/rekap', require('./routes/rekap'));
app.use('/api/settings', require('./routes/settings'));

// SPA fallback - Express v5 compatible
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ FLa POS System berjalan di http://localhost:${PORT}`);
  console.log(`📊 Database: SQLite (data/flapos.db)`);
  console.log(`\nDefault Password Admin:`);
  console.log(`  🔐 Admin Pembukuan : admin123`);
  console.log(`  📋 Admin Absensi   : absensi123`);
  console.log(`  📦 Admin Gudang    : gudang123\n`);
});

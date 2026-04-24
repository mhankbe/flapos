const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Create uploads directories
['uploads/foto-absensi','uploads/foto-karyawan'].forEach(d => {
  const p = path.join(__dirname, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/flapos',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Helper functions for compatibility with SQLite style
const db = {
  // Query returning all rows
  all: async (sql, params = []) => {
    const result = await pool.query(sql, params);
    return result.rows;
  },
  // Query returning single row
  get: async (sql, params = []) => {
    const result = await pool.query(sql, params);
    return result.rows[0] || null;
  },
  // Execute query (INSERT, UPDATE, DELETE)
  run: async (sql, params = []) => {
    const result = await pool.query(sql, params);
    return {
      lastInsertRowid: result.rows[0]?.id || result.rows[0]?.insert_id || null,
      changes: result.rowCount
    };
  },
  // For transactions
  query: (sql, params) => pool.query(sql, params),
  pool
};

// Initialize tables
async function initTables() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    // Karyawan table
    await client.query(`
      CREATE TABLE IF NOT EXISTS karyawan (
        id SERIAL PRIMARY KEY,
        nik TEXT,
        nama TEXT NOT NULL,
        jabatan TEXT,
        departemen TEXT,
        gaji_pokok REAL DEFAULT 0,
        tunjangan REAL DEFAULT 0,
        lembur_per_jam REAL DEFAULT 0,
        bpjs_pct REAL DEFAULT 2,
        tanggal_masuk TEXT,
        no_hp TEXT,
        status TEXT DEFAULT 'aktif',
        foto_referensi TEXT,
        face_descriptor TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Absensi table
    await client.query(`
      CREATE TABLE IF NOT EXISTS absensi (
        id SERIAL PRIMARY KEY,
        karyawan_id INTEGER,
        nama TEXT,
        nik TEXT,
        jabatan TEXT,
        tanggal DATE,
        jam_absen TEXT,
        shift TEXT DEFAULT 'full',
        status TEXT DEFAULT 'hadir',
        lembur_jam REAL DEFAULT 0,
        foto_absen TEXT,
        face_match REAL DEFAULT 0,
        keterangan TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (karyawan_id) REFERENCES karyawan(id) ON DELETE CASCADE
      )
    `);

    // Produk table
    await client.query(`
      CREATE TABLE IF NOT EXISTS produk (
        id SERIAL PRIMARY KEY,
        barcode TEXT,
        nama TEXT NOT NULL,
        kategori TEXT DEFAULT 'Umum',
        hpp REAL DEFAULT 0,
        harga_jual REAL NOT NULL,
        stok INTEGER DEFAULT 0,
        stok_min INTEGER DEFAULT 5,
        satuan TEXT DEFAULT 'pcs',
        icon TEXT DEFAULT '📦',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Stok log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stok_log (
        id SERIAL PRIMARY KEY,
        produk_id INTEGER,
        produk_nama TEXT,
        jenis TEXT,
        qty INTEGER,
        stok_sebelum INTEGER,
        stok_sesudah INTEGER,
        harga_satuan REAL DEFAULT 0,
        supplier TEXT,
        keterangan TEXT,
        admin TEXT,
        tanggal DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (produk_id) REFERENCES produk(id) ON DELETE SET NULL
      )
    `);

    // Transaksi table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transaksi (
        id SERIAL PRIMARY KEY,
        invoice TEXT UNIQUE,
        tanggal DATE,
        jam TEXT,
        subtotal REAL DEFAULT 0,
        diskon REAL DEFAULT 0,
        pajak REAL DEFAULT 0,
        total REAL DEFAULT 0,
        kembalian REAL DEFAULT 0,
        metode_bayar TEXT DEFAULT 'tunai',
        kasir TEXT,
        profit REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Transaksi item table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transaksi_item (
        id SERIAL PRIMARY KEY,
        transaksi_id INTEGER,
        invoice TEXT,
        produk_id INTEGER,
        produk_nama TEXT,
        barcode TEXT,
        kategori TEXT,
        qty INTEGER,
        harga_jual REAL,
        hpp REAL DEFAULT 0,
        subtotal REAL,
        profit REAL,
        FOREIGN KEY (transaksi_id) REFERENCES transaksi(id) ON DELETE CASCADE
      )
    `);

    // Insert default settings
    const defaultSettings = [
      ['pw_pembukuan', 'admin123'],
      ['pw_absensi', 'absensi123'],
      ['pw_gudang', 'gudang123'],
      ['nama_toko', 'FLa POS System'],
      ['alamat_toko', 'Jl. Contoh No. 1'],
      ['ppn_pct', '0'],
      ['hari_kerja_per_bulan', '26'],
      ['potongan_alpha_per_hari', '50000'],
      ['bonus_hadir_penuh', '100000']
    ];

    for (const [key, value] of defaultSettings) {
      await client.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
        [key, value]
      );
    }

    await client.query('COMMIT');
    console.log('✅ Database PostgreSQL initialized');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database init error:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run initialization
initTables().catch(console.error);

module.exports = db;

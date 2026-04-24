// routes/produk.js
const router = require('express').Router();
const db = require('../database');
const { requireRole } = require('../middleware/auth');

router.get('/', async (req, res) => {
  const rows = await db.all('SELECT * FROM produk ORDER BY nama');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const r = await db.get('SELECT * FROM produk WHERE id=$1', [req.params.id]);
  r ? res.json(r) : res.status(404).json({error:'Not found'});
});

router.post('/', requireRole('pembukuan'), async (req, res) => {
  const { barcode,nama,kategori,hpp,harga_jual,stok,stok_min,satuan,icon } = req.body;
  if(!nama||!harga_jual) return res.status(400).json({error:'Nama dan harga wajib'});
  const r = await db.run(
    'INSERT INTO produk (barcode,nama,kategori,hpp,harga_jual,stok,stok_min,satuan,icon) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
    [barcode||'',nama,kategori||'Umum',hpp||0,harga_jual,stok||0,stok_min||5,satuan||'pcs',icon||'📦']
  );
  res.json({success:true,id:r.lastInsertRowid});
});

router.put('/:id', requireRole('pembukuan'), async (req, res) => {
  const { barcode,nama,kategori,hpp,harga_jual,stok,stok_min,satuan,icon } = req.body;
  await db.run(
    `UPDATE produk SET barcode=$1,nama=$2,kategori=$3,hpp=$4,harga_jual=$5,stok=$6,stok_min=$7,satuan=$8,icon=$9,updated_at=CURRENT_TIMESTAMP WHERE id=$10`,
    [barcode||'',nama,kategori||'Umum',hpp||0,harga_jual,stok||0,stok_min||5,satuan||'pcs',icon||'📦',req.params.id]
  );
  res.json({success:true});
});

router.delete('/:id', requireRole('pembukuan'), async (req, res) => {
  await db.run('DELETE FROM produk WHERE id=$1', [req.params.id]);
  res.json({success:true});
});

// Barcode lookup
router.get('/barcode/:kode', async (req, res) => {
  const r = await db.get('SELECT * FROM produk WHERE barcode=$1', [req.params.kode]);
  r ? res.json(r) : res.status(404).json({error:'Tidak ditemukan'});
});

module.exports = router;

const router = require('express').Router();
const db = require('../database');

router.get('/', async (req, res) => {
  const { dari, sampai, produk_id, jenis } = req.query;
  let q = 'SELECT * FROM stok_log WHERE 1=1'; const p = [];
  if(dari){q+=' AND tanggal>=$1';p.push(dari);}
  if(sampai){q+=' AND tanggal<=$2';p.push(sampai);}
  if(produk_id){q+=' AND produk_id=$3';p.push(produk_id);}
  if(jenis){q+=' AND jenis=$4';p.push(jenis);}
  // Adjust placeholders
  let idx = 1;
  q = q.replace(/\$\d+/g, () => `$${idx++}`);
  q+=' ORDER BY created_at DESC';
  res.json(await db.all(q, p));
});

router.post('/', async (req, res) => {
  const role = req.headers['x-admin-role'];
  if(!['pembukuan','gudang'].includes(role)) return res.status(403).json({error:'Akses ditolak'});
  const { produk_id, jenis, qty, harga_satuan, supplier, keterangan, tanggal } = req.body;
  const prod = await db.get('SELECT * FROM produk WHERE id=$1', [produk_id]);
  if(!prod) return res.status(404).json({error:'Produk tidak ditemukan'});
  const jumlah = parseInt(qty)||0;
  if(!jumlah) return res.status(400).json({error:'Qty harus diisi'});
  const sebelum = prod.stok;
  let sesudah;
  if(jenis==='masuk') sesudah = sebelum + jumlah;
  else if(jenis==='keluar'||jenis==='rusak') sesudah = Math.max(0, sebelum - jumlah);
  else sesudah = jumlah;
  await db.run('UPDATE produk SET stok=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [sesudah, produk_id]);
  const r = await db.run(
    'INSERT INTO stok_log (produk_id,produk_nama,jenis,qty,stok_sebelum,stok_sesudah,harga_satuan,supplier,keterangan,admin,tanggal) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',
    [produk_id,prod.nama,jenis,jumlah,sebelum,sesudah,harga_satuan||0,supplier||'',keterangan||'',role,tanggal||new Date().toISOString().split('T')[0]]
  );
  res.json({success:true,id:r.lastInsertRowid,stok_sesudah:sesudah});
});

router.delete('/:id', async (req, res) => {
  const role = req.headers['x-admin-role'];
  if(!['pembukuan'].includes(role)) return res.status(403).json({error:'Hanya Admin Pembukuan'});
  await db.run('DELETE FROM stok_log WHERE id=$1', [req.params.id]);
  res.json({success:true});
});

module.exports = router;

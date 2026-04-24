const router = require('express').Router();
const db = require('../database');

router.get('/', async (req, res) => {
  const { dari, sampai } = req.query;
  let q = 'SELECT * FROM transaksi WHERE 1=1'; const p = [];
  let idx = 1;
  if(dari){q+=` AND tanggal>=$${idx++}`;p.push(dari);}
  if(sampai){q+=` AND tanggal<=$${idx++}`;p.push(sampai);}
  q+=' ORDER BY created_at DESC';
  const trx = await db.all(q, p);
  const result = [];
  for(const t of trx) {
    const items = await db.all('SELECT * FROM transaksi_item WHERE transaksi_id=$1', [t.id]);
    result.push({ ...t, items });
  }
  res.json(result);
});

router.post('/', async (req, res) => {
  const { invoice, tanggal, jam, subtotal, diskon, pajak, total, kembalian, metode_bayar, kasir, profit, items } = req.body;
  if(!invoice||!total) return res.status(400).json({error:'Data tidak lengkap'});

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const r = await client.query(
      'INSERT INTO transaksi (invoice,tanggal,jam,subtotal,diskon,pajak,total,kembalian,metode_bayar,kasir,profit) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',
      [invoice,tanggal,jam,subtotal||0,diskon||0,pajak||0,total,kembalian||0,metode_bayar||'tunai',kasir||'Admin',profit||0]
    );
    const tid = r.rows[0].id;

    if(items?.length) {
      for(const it of items) {
        await client.query(
          'INSERT INTO transaksi_item (transaksi_id,invoice,produk_id,produk_nama,barcode,kategori,qty,harga_jual,hpp,subtotal,profit) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          [tid, invoice, it.produk_id||null, it.nama, it.barcode||'', it.kategori||'', it.qty, it.harga_jual||it.price, it.hpp||0, it.subtotal||it.price*it.qty, it.profit||0]
        );
        // Update stok
        if(it.produk_id) {
          const prodRes = await client.query('UPDATE produk SET stok=GREATEST(0,stok-$1),updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING stok', [it.qty, it.produk_id]);
          if(prodRes.rows.length > 0) {
            const newStok = prodRes.rows[0].stok;
            await client.query(
              'INSERT INTO stok_log (produk_id,produk_nama,jenis,qty,stok_sebelum,stok_sesudah,harga_satuan,keterangan,admin,tanggal) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
              [it.produk_id,it.nama,'keluar',it.qty,(newStok+it.qty),newStok,it.harga_jual||0,'Penjualan kasir '+invoice,'kasir',tanggal]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
    res.json({success:true,id:tid,invoice});
  } catch(err) {
    await client.query('ROLLBACK');
    console.error('Transaction error:', err);
    res.status(500).json({error: err.message});
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  const role = req.headers['x-admin-role'];
  if(role!=='pembukuan') return res.status(403).json({error:'Hanya Admin Pembukuan'});
  await db.run('DELETE FROM transaksi WHERE id=$1', [req.params.id]);
  res.json({success:true});
});

module.exports = router;

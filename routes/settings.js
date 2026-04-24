const router = require('express').Router();
const db = require('../database');

router.get('/', async (req, res) => {
  const rows = await db.all('SELECT * FROM settings');
  const out = {};
  rows.forEach(r => { if(!r.key.startsWith('pw_')) out[r.key] = r.value; });
  res.json(out);
});

router.put('/', async (req, res) => {
  const role = req.headers['x-admin-role'];
  if(role !== 'pembukuan') return res.status(403).json({error:'Hanya Admin Pembukuan'});
  const allowed = ['nama_toko','alamat_toko','ppn_pct','hari_kerja_per_bulan','potongan_alpha_per_hari','bonus_hadir_penuh'];
  for(const [k,v] of Object.entries(req.body)) {
    if(allowed.includes(k)) await db.run(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [k, String(v)]
    );
  }
  res.json({success:true});
});

module.exports = router;

const router = require('express').Router();
const db = require('../database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireRole } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/foto-karyawan')),
  filename: (req, file, cb) => cb(null, `ref_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', async (req, res) => {
  const rows = await db.all('SELECT * FROM karyawan ORDER BY nama');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const row = await db.get('SELECT * FROM karyawan WHERE id = $1', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Tidak ditemukan' });
  res.json(row);
});

router.post('/', requireRole('pembukuan'), upload.single('foto'), async (req, res) => {
  const { nik, nama, jabatan, departemen, gaji_pokok, tunjangan, lembur_per_jam, bpjs_pct, tanggal_masuk, no_hp, status, face_descriptor } = req.body;
  if (!nama) return res.status(400).json({ error: 'Nama wajib diisi' });
  const foto = req.file ? `/uploads/foto-karyawan/${req.file.filename}` : null;
  const result = await db.run(
    `INSERT INTO karyawan (nik,nama,jabatan,departemen,gaji_pokok,tunjangan,lembur_per_jam,bpjs_pct,tanggal_masuk,no_hp,status,foto_referensi,face_descriptor)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [nik||'', nama, jabatan||'', departemen||'', gaji_pokok||0, tunjangan||0, lembur_per_jam||0, bpjs_pct||2, tanggal_masuk||'', no_hp||'', status||'aktif', foto, face_descriptor||null]
  );
  res.json({ success: true, id: result.lastInsertRowid });
});

router.put('/:id', requireRole('pembukuan'), upload.single('foto'), async (req, res) => {
  const { nik, nama, jabatan, departemen, gaji_pokok, tunjangan, lembur_per_jam, bpjs_pct, tanggal_masuk, no_hp, status, face_descriptor } = req.body;
  const existing = await db.get('SELECT * FROM karyawan WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Tidak ditemukan' });
  let foto = existing.foto_referensi;
  if (req.file) {
    if (foto) { try { fs.unlinkSync(path.join(__dirname, '..', foto)); } catch(e){} }
    foto = `/uploads/foto-karyawan/${req.file.filename}`;
  }
  await db.run(
    `UPDATE karyawan SET nik=$1,nama=$2,jabatan=$3,departemen=$4,gaji_pokok=$5,tunjangan=$6,lembur_per_jam=$7,bpjs_pct=$8,tanggal_masuk=$9,no_hp=$10,status=$11,foto_referensi=$12,face_descriptor=$13,updated_at=CURRENT_TIMESTAMP
     WHERE id=$14`,
    [nik||'', nama, jabatan||'', departemen||'', gaji_pokok||0, tunjangan||0, lembur_per_jam||0, bpjs_pct||2, tanggal_masuk||'', no_hp||'', status||'aktif', foto, face_descriptor||existing.face_descriptor, req.params.id]
  );
  res.json({ success: true });
});

router.delete('/:id', requireRole('pembukuan'), async (req, res) => {
  const existing = await db.get('SELECT * FROM karyawan WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Tidak ditemukan' });
  if (existing.foto_referensi) { try { fs.unlinkSync(path.join(__dirname, '..', existing.foto_referensi)); } catch(e){} }
  await db.run('DELETE FROM karyawan WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// Endpoint untuk update face descriptor saja
router.patch('/:id/face', requireRole('pembukuan'), async (req, res) => {
  const { face_descriptor } = req.body;
  await db.run('UPDATE karyawan SET face_descriptor=$1 WHERE id=$2', [face_descriptor, req.params.id]);
  res.json({ success: true });
});

module.exports = router;

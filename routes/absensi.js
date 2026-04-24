const router = require('express').Router();
const db = require('../database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/foto-absensi')),
  filename: (req, file, cb) => cb(null, `ab_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET rekap absensi
router.get('/', async (req, res) => {
  const { dari, sampai, bulan, tahun, karyawan_id } = req.query;
  let q = 'SELECT * FROM absensi WHERE 1=1';
  const params = [];
  let idx = 1;
  if (dari) { q += ` AND tanggal >= $${idx++}`; params.push(dari); }
  if (sampai) { q += ` AND tanggal <= $${idx++}`; params.push(sampai); }
  if (bulan && tahun) { 
    q += ` AND EXTRACT(MONTH FROM tanggal) = $${idx++} AND EXTRACT(YEAR FROM tanggal) = $${idx++}`; 
    params.push(parseInt(bulan), parseInt(tahun)); 
  }
  if (karyawan_id) { q += ` AND karyawan_id = $${idx++}`; params.push(karyawan_id); }
  q += ' ORDER BY tanggal DESC, created_at DESC';
  res.json(await db.all(q, params));
});

// POST absensi via upload foto
router.post('/upload', upload.single('foto'), async (req, res) => {
  try {
    const { karyawan_id, nama, face_match, shift, lembur_jam, keterangan } = req.body;
    if (!karyawan_id) return res.status(400).json({ error: 'karyawan_id wajib' });
    const karyw = await db.get('SELECT * FROM karyawan WHERE id = $1 AND status = $2', [karyawan_id, 'aktif']);
    if (!karyw) return res.status(404).json({ error: 'Karyawan tidak ditemukan atau tidak aktif' });
    const tanggal = new Date().toISOString().split('T')[0];
    const jam = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const existing = await db.get('SELECT id FROM absensi WHERE karyawan_id = $1 AND tanggal = $2', [karyawan_id, tanggal]);
    if (existing) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch(e){} }
      return res.status(400).json({ error: `${karyw.nama} sudah absen hari ini (${tanggal})` });
    }
    const faceScore = parseFloat(face_match) || 0;
    const foto = req.file ? `/uploads/foto-absensi/${req.file.filename}` : null;
    const result = await db.run(
      `INSERT INTO absensi (karyawan_id, nama, nik, jabatan, tanggal, jam_absen, shift, status, lembur_jam, foto_absen, face_match, keterangan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [karyw.id, karyw.nama, karyw.nik||'', karyw.jabatan||'', tanggal, jam, shift||'full', 'hadir', lembur_jam||0, foto, faceScore, keterangan||'']
    );
    res.json({
      success: true,
      id: result.lastInsertRowid,
      nama: karyw.nama,
      tanggal,
      jam_absen: jam,
      face_match: faceScore
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST absensi manual
router.post('/manual', async (req, res) => {
  const role = req.headers['x-admin-role'];
  if (!['pembukuan','absensi'].includes(role)) return res.status(403).json({ error: 'Akses ditolak' });
  const { karyawan_id, tanggal, status, shift, lembur_jam, keterangan } = req.body;
  const karyw = await db.get('SELECT * FROM karyawan WHERE id = $1', [karyawan_id]);
  if (!karyw) return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
  const tgl = tanggal || new Date().toISOString().split('T')[0];
  const existing = await db.get('SELECT id FROM absensi WHERE karyawan_id = $1 AND tanggal = $2', [karyawan_id, tgl]);
  if (existing) {
    await db.run(
      'UPDATE absensi SET status=$1, shift=$2, lembur_jam=$3, keterangan=$4 WHERE id=$5',
      [status||'hadir', shift||'full', lembur_jam||0, keterangan||'', existing.id]
    );
  } else {
    await db.run(
      `INSERT INTO absensi (karyawan_id, nama, nik, jabatan, tanggal, jam_absen, shift, status, lembur_jam, keterangan) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [karyw.id, karyw.nama, karyw.nik||'', karyw.jabatan||'', tgl, new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}), shift||'full', status||'hadir', lembur_jam||0, keterangan||'']
    );
  }
  res.json({ success: true });
});

// Hadir semua bulk
router.post('/hadir-semua', async (req, res) => {
  const role = req.headers['x-admin-role'];
  if (!['pembukuan','absensi'].includes(role)) return res.status(403).json({ error: 'Akses ditolak' });
  const { tanggal, shift } = req.body;
  const tgl = tanggal || new Date().toISOString().split('T')[0];
  const karyawan = await db.all('SELECT * FROM karyawan WHERE status = $1', ['aktif']);
  let count = 0;
  for (const k of karyawan) {
    const ex = await db.get('SELECT id FROM absensi WHERE karyawan_id = $1 AND tanggal = $2', [k.id, tgl]);
    if (!ex) {
      await db.run(
        'INSERT INTO absensi (karyawan_id,nama,nik,jabatan,tanggal,jam_absen,shift,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [k.id, k.nama, k.nik||'', k.jabatan||'', tgl, '00:00', shift||'full', 'hadir']
      );
      count++;
    }
  }
  res.json({ success: true, count });
});

router.delete('/:id', async (req, res) => {
  const role = req.headers['x-admin-role'];
  if (!['pembukuan','absensi'].includes(role)) return res.status(403).json({ error: 'Akses ditolak' });
  const row = await db.get('SELECT * FROM absensi WHERE id = $1', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Tidak ditemukan' });
  if (row.foto_absen) { try { fs.unlinkSync(path.join(__dirname, '..', row.foto_absen)); } catch(e){} }
  await db.run('DELETE FROM absensi WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;

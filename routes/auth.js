const router = require('express').Router();
const db = require('../database');

router.post('/login', async (req, res) => {
  const { role, password } = req.body;
  const validRoles = ['pembukuan', 'absensi', 'gudang'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Role tidak valid' });
  const row = await db.get('SELECT value FROM settings WHERE key = $1', [`pw_${role}`]);
  if (!row) return res.status(500).json({ error: 'Setting tidak ditemukan' });
  if (row.value !== password) return res.status(401).json({ error: 'Password salah' });
  res.json({ success: true, role, message: `Login berhasil sebagai ${role}` });
});

router.post('/change-password', async (req, res) => {
  const role = req.headers['x-admin-role'];
  if (role !== 'pembukuan') return res.status(403).json({ error: 'Hanya Admin Pembukuan' });
  const { target_role, new_password } = req.body;
  if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Password min 6 karakter' });
  await db.run('UPDATE settings SET value = $1 WHERE key = $2', [new_password, `pw_${target_role}`]);
  res.json({ success: true });
});

module.exports = router;

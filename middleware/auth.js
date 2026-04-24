const db = require('../database');

function requireRole(role) {
  return (req, res, next) => {
    const token = req.headers['x-admin-role'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    // roles: pembukuan, absensi, gudang
    // pembukuan can access everything
    if (token === 'pembukuan') return next();
    if (token === role) return next();
    return res.status(403).json({ error: 'Akses ditolak untuk role ini' });
  };
}

module.exports = { requireRole };

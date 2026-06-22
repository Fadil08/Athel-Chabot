const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'chatagentive-super-secret-key-9988';

module.exports = function(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Akses ditolak: Token tidak ditemukan' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak: Format token salah' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Token tidak valid' });
  }
};

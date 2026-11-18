const crypto = require('crypto');
const config = require('../config');

module.exports = function requireAdmin(req, res, next) {
  const expected = config.adminToken;
  const supplied = req.get('x-admin-token') || '';
  if (!expected || !supplied) return res.status(503).json({ message: 'Admin API is not configured.' });
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ message: 'Unauthorised.' });
  next();
};

const db = require('../config/database');
module.exports = (_req, res, next) => db.isReady()
  ? next()
  : res.status(503).json({ message: 'The payment database is unavailable. Please try again later.' });

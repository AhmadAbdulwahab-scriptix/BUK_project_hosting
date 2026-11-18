const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const notFoundApi = (_req, res) => res.status(404).json({ message: 'Not found.' });

// Every error from every route ends up here, so controllers never repeat try/catch.
function errorHandler(error, req, res, _next) {
  if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message, ...error.extra });
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Request too large.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON.' });
  logger.error(`${req.method} ${req.originalUrl} failed:`, error);
  return res.status(500).json({ message: 'Something went wrong. Please try again.' });
}

module.exports = { errorHandler, notFoundApi };

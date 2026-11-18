const AppError = require('../utils/AppError');

// Checks the raw request and returns clean values, or throws a 400 with a friendly message.
function validateInitialize(req) {
  const body = req.body || {};
  const domain = body.domain;
  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.fullName || '').trim();
  const idempotencyKey = String(req.get('Idempotency-Key') || '').trim();
  const studentId = body.studentId;

  if (!['com', 'ng'].includes(domain)) throw new AppError(400, 'Please choose either .com or .ng.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400, 'Enter a valid email address.');
  if (fullName.length < 2 || fullName.length > 120) throw new AppError(400, 'Enter a valid name (2–120 characters).');
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotencyKey)) {
    throw new AppError(400, 'Missing or invalid payment attempt key. Refresh the form and try again.');
  }
  if (!studentId) throw new AppError(400, 'Please select a student before proceeding with payment.');
  return { domain, email, fullName, idempotencyKey, studentId };
}

function validateRefund(body = {}) {
  const reason = String(body.reason || '').trim();
  const refundReference = String(body.refundReference || '').trim();
  if (reason.length < 5 || reason.length > 500 || refundReference.length < 3 || refundReference.length > 100) {
    throw new AppError(400, 'Provide a refund reason and Paystack refund reference.');
  }
  return { reason, refundReference };
}

module.exports = { validateInitialize, validateRefund };

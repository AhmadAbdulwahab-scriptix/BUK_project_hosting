const config = require('../config');
const db = require('../config/database');
const orderService = require('../services/order.service');
const reconciliation = require('../services/reconciliation.service');
const { validateInitialize } = require('../validators/payment.validator');
const { PRICES_Naira, REFERENCE_PATTERN } = require('../helpers/payments');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

const getConfig = (_req, res) => res.json({ supportEmail: config.supportEmail, pricesNaira: PRICES_Naira });

const initialize = asyncHandler(async (req, res) => {
  const input = validateInitialize(req);
  if (!config.paystack.secretKey) throw new AppError(503, 'Payments are not configured yet.');
  res.json(await orderService.initializePayment(input));
});

// The browser lands here after Paystack. The page only shows what the server verified.
async function callback(req, res) {
  const reference = String(req.query.reference || '');
  if (!REFERENCE_PATTERN.test(reference) || !config.paystack.secretKey || !db.isReady()) return res.redirect('/?payment=unverified');

  const page = `/order?reference=${encodeURIComponent(reference)}`;
  try {
    const outcome = await reconciliation.reconcileReference(reference, { timeoutMs: config.paystack.callbackTimeoutMs });
    if (['paid', 'already-paid', 'failed', 'abandoned'].includes(outcome)) return res.redirect(page);
    if (outcome === 'review-required') return res.redirect(`${page}&notice=review`);
    return res.redirect(`${page}&notice=pending`);
  } catch (error) {
    // Slow or unreachable Paystack: show "pending"; the background sweep will finish the job.
    logger.error('Callback verification error:', error.message);
    return res.redirect(`${page}&notice=pending`);
  }
}

module.exports = { getConfig, initialize, callback };

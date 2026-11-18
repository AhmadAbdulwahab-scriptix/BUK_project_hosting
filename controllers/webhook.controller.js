const config = require('../config');
const db = require('../config/database');
const webhookService = require('../services/webhook.service');
const { verifyPaystackSignature } = require('../helpers/payments');
const logger = require('../utils/logger');

/**
 * Paystack wants a fast 2xx. We verify the signature, SAVE the event, answer 200, and only then
 * do the slow part (calling Paystack to verify) in the background. If that fails, the saved
 * receipt is retried by the webhook sweep, so acknowledging early loses nothing.
 */
async function handlePaystackWebhook(req, res) {
  try {
    if (!Buffer.isBuffer(req.body)) return res.status(400).send('Expected raw JSON body.');
    if (!config.paystack.secretKey) return res.status(503).send('Payment service is not configured.');
    if (!db.isReady()) return res.status(503).send('Database temporarily unavailable.');
    if (!verifyPaystackSignature(req.body, req.headers['x-paystack-signature'], config.paystack.secretKey)) {
      return res.status(401).send('Invalid Paystack signature.');
    }

    const payload = JSON.parse(req.body.toString('utf8'));
    const { receipt, alreadyProcessed } = await webhookService.receive(req.body, payload);
    res.sendStatus(200);
    if (receipt && !alreadyProcessed) webhookService.enqueue(receipt._id);
  } catch (error) {
    logger.error('Paystack webhook intake error:', error.message);
    // Nothing was saved, so ask Paystack to retry.
    if (!res.headersSent) res.sendStatus(500);
  }
}

module.exports = { handlePaystackWebhook };

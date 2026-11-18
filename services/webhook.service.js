// Durable webhook inbox: save first (so nothing is lost), answer Paystack fast, process in the background.
const config = require('../config');
const Order = require('../models/Order');
const WebhookReceipt = require('../models/WebhookReceipt');
const reconciliation = require('./reconciliation.service');
const { hashBody, backoffDelay, REFERENCE_PATTERN } = require('../helpers/payments');
const { createLimiter, mapWithConcurrency } = require('../utils/concurrency');
const logger = require('../utils/logger');
const { WEBHOOK_STATE: W } = require('../constants/webhookState');

// Caps how many Paystack verifications webhooks can start at once (a burst waits here in memory;
// anything lost on a crash is picked up by sweepWebhooks from MongoDB).
const limit = createLimiter(config.webhook.concurrency);

/** Stores the event. Returns the receipt and whether it was already fully processed. */
async function receive(rawBody, payload) {
  const eventHash = hashBody(rawBody);
  const reference = payload.data && typeof payload.data.reference === 'string' ? payload.data.reference : undefined;
  try {
    const receipt = await WebhookReceipt.create({ eventHash, event: String(payload.event || 'unknown'), reference, state: W.RECEIVED });
    return { receipt, alreadyProcessed: false };
  } catch (error) {
    if (error.code !== 11000) throw error;
    const receipt = await WebhookReceipt.findOne({ eventHash });
    return { receipt, alreadyProcessed: !receipt || receipt.state === W.PROCESSED || receipt.state === W.DEAD };
  }
}

// A lease lets a later attempt recover a receipt if a process crashed while handling it.
function claim(receiptId) {
  const now = new Date();
  return WebhookReceipt.findOneAndUpdate(
    {
      _id: receiptId,
      $or: [
        { state: { $in: [W.RECEIVED, W.RETRYABLE] } },
        { state: W.PROCESSING, lockUntil: { $lt: now } },
        { state: W.PROCESSING, lockUntil: { $exists: false } }
      ]
    },
    { $set: { state: W.PROCESSING, lockUntil: new Date(now.getTime() + config.webhook.lockMs) }, $inc: { attempts: 1 } },
    { new: true }
  );
}

function markProcessed(receiptId, outcome) {
  return WebhookReceipt.updateOne(
    { _id: receiptId },
    { $set: { state: W.PROCESSED, processedAt: new Date(), outcome }, $unset: { lockUntil: 1, nextAttemptAt: 1 } }
  );
}

async function handleClaimed(receipt) {
  const { reference, event } = receipt;
  if (!reference) { await markProcessed(receipt._id, 'missing-reference'); return 'missing-reference'; }

  const order = REFERENCE_PATTERN.test(reference) ? await Order.findOne({ reference }).select('_id').lean() : null;
  if (!order) {
    // Unknown references can never create an order or mark anything paid.
    await markProcessed(receipt._id, 'unknown-reference');
    logger.warn('Paystack webhook received for unknown reference:', reference);
    return 'unknown-reference';
  }

  if (event === 'charge.success' || event === 'charge.failed') {
    // Verify success AND failure events: a stale failed event must not downgrade a real payment.
    return reconciliation.verifyAndCommit(order._id, reference, { receiptId: receipt._id });
  }
  await markProcessed(receipt._id, 'ignored-event');
  return 'ignored-event';
}

async function processReceipt(receiptId) {
  const claimed = await claim(receiptId);
  if (!claimed) return 'not-claimed'; // someone else is on it, or it is already done
  try {
    return await handleClaimed(claimed);
  } catch (error) {
    logger.error('Paystack webhook processing error:', error.message);
    const dead = claimed.attempts >= config.webhook.maxAttempts;
    await WebhookReceipt.updateOne(
      { _id: claimed._id, state: { $ne: W.PROCESSED } },
      {
        $set: {
          state: dead ? W.DEAD : W.RETRYABLE,
          lastError: String(error.message || error).slice(0, 500),
          nextAttemptAt: new Date(Date.now() + backoffDelay(claimed.attempts, { baseMs: 30 * 1000, maxMs: 30 * 60 * 1000 }))
        },
        $unset: { lockUntil: 1 }
      }
    ).catch(updateError => logger.error('Could not mark webhook retryable:', updateError.message));
    if (dead) logger.error(`Webhook ${claimed._id} gave up after ${claimed.attempts} attempts.`);
    return 'error';
  }
}

/** Fire-and-forget: used right after the HTTP response has been sent. */
function enqueue(receiptId) {
  limit(() => processReceipt(receiptId)).catch(error => logger.error('Webhook queue error:', error.message));
}

/** Recovery sweep for receipts that were never finished (crash, Paystack outage, lost queue). */
async function sweepWebhooks(now = new Date()) {
  const due = await WebhookReceipt.find({
    $or: [
      { state: W.RECEIVED, receivedAt: { $lt: new Date(now.getTime() - config.webhook.sweepAfterMs) } },
      { state: W.RETRYABLE, $or: [{ nextAttemptAt: { $lte: now } }, { nextAttemptAt: null }] },
      { state: W.PROCESSING, lockUntil: { $lt: now } }
    ]
  }).sort({ receivedAt: 1 }).limit(config.reconcile.batchSize).select('_id').lean();
  if (due.length === 0) return { due: 0 };

  await mapWithConcurrency(due, config.webhook.concurrency, r => processReceipt(r._id));
  logger.info(`Webhook sweep: processed ${due.length} pending receipt(s).`);
  return { due: due.length };
}

module.exports = { receive, enqueue, processReceipt, sweepWebhooks };

const mongoose = require('mongoose');
const { ALL_WEBHOOK_STATES, WEBHOOK_STATE } = require('../constants/webhookState');
const config = require('../config');

const webhookReceiptSchema = new mongoose.Schema({
  eventHash: { type: String, required: true, unique: true },
  event: { type: String, required: true },
  reference: String,
  state: { type: String, enum: ALL_WEBHOOK_STATES, default: WEBHOOK_STATE.RECEIVED },
  attempts: { type: Number, default: 0 },
  receivedAt: { type: Date, default: Date.now },
  // Old processed receipts are deleted automatically so this collection cannot grow forever.
  processedAt: { type: Date, expires: config.webhook.retentionSeconds },
  lockUntil: Date,
  nextAttemptAt: Date,
  lastError: String,
  outcome: String
}, { timestamps: true });

webhookReceiptSchema.index({ state: 1, nextAttemptAt: 1 });

module.exports = mongoose.model('WebhookReceipt', webhookReceiptSchema);

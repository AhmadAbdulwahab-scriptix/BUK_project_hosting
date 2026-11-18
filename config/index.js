require('dotenv').config();

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const port = Number(process.env.PORT || 3050);

// Secrets are exposed as getters so they are always read live from process.env
// (this also makes them easy to change in tests).
const config = {
  port,
  baseUrl: (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  supportEmail: process.env.SUPPORT_EMAIL || '',
  get mongoUri() { return process.env.MONGODB_URI; },
  get adminToken() { return process.env.ADMIN_API_TOKEN; },

  paystack: {
    apiUrl: 'https://api.paystack.co',
    get secretKey() { return process.env.PAYSTACK_SECRET_KEY; },
    timeoutMs: 15 * 1000,
    // The browser is waiting on the callback, so give up sooner and let the
    // background reconciler finish the job.
    callbackTimeoutMs: 8 * 1000
  },

  mongo: { maxPoolSize: 20, serverSelectionTimeoutMs: 10 * 1000 },

  order: {
    lifetimeMs: DAY,
    initializingStaleMs: 2 * MINUTE,   // an "initializing" order older than this may be retried
    initializationGiveUpMs: 10 * MINUTE // ...and may be closed if Paystack never heard of it
  },

  webhook: {
    lockMs: 2 * MINUTE,
    sweepAfterMs: 30 * 1000,   // sweeper ignores receipts that are probably still in-flight
    maxAttempts: 10,
    concurrency: 5,            // max parallel Paystack verifications started by webhooks
    retentionSeconds: 90 * 24 * 60 * 60
  },

  reconcile: {
    intervalMs: 5 * MINUTE,
    webhookSweepIntervalMs: MINUTE,
    initialDelayMs: 10 * 1000,
    batchSize: 50,
    concurrency: 5,
    leaseMs: 2 * MINUTE,                 // per-order claim so two instances never verify the same order
    activeBackoff: { baseMs: 2 * MINUTE, maxMs: 30 * MINUTE },
    lateBackoff: { baseMs: 30 * MINUTE, maxMs: 6 * HOUR }, // failed/abandoned/expired
    lateWindowMs: 7 * DAY                // stop auto-checking closed orders after this long
  },

  rateLimit: {
    initialize: { windowMs: MINUTE, max: 10 },
    status: { windowMs: MINUTE, max: 60 },
    callback: { windowMs: MINUTE, max: 30 },
    admin: { windowMs: MINUTE, max: 30 }
  }
};

module.exports = config;

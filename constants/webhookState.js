const WEBHOOK_STATE = Object.freeze({
  RECEIVED: 'received',
  PROCESSING: 'processing',
  RETRYABLE: 'retryable',
  PROCESSED: 'processed',
  DEAD: 'dead' // gave up after too many attempts; needs a human
});
module.exports = { WEBHOOK_STATE, ALL_WEBHOOK_STATES: Object.values(WEBHOOK_STATE) };

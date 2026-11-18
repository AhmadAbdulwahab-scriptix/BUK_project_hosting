// One place that names every order state, so no file ever hard-codes a status string.
const ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  INITIALIZING: 'initializing',
  INITIALIZATION_FAILED: 'initialization_failed',
  INITIALIZATION_UNKNOWN: 'initialization_unknown',
  VERIFICATION_PENDING: 'verification_pending',
  PAID: 'paid',
  FAILED: 'failed',
  ABANDONED: 'abandoned',
  EXPIRED: 'expired',
  REVIEW_REQUIRED: 'review_required',
  REFUND_PENDING: 'refund_pending',
  REFUNDED: 'refunded'
});

const S = ORDER_STATUS;

module.exports = {
  ORDER_STATUS,
  ALL_STATUSES: Object.values(ORDER_STATUS),
  // Never downgraded by a late webhook or reconciliation result.
  IMMUTABLE: [S.PAID, S.REFUNDED],
  // Paystack may still turn these into "paid"; checked frequently.
  ACTIVE_RECONCILABLE: [S.INITIALIZING, S.PENDING, S.INITIALIZATION_UNKNOWN, S.VERIFICATION_PENDING],
  // Closed locally, but a late success is still possible; checked rarely and only for a limited window.
  LATE_CHECK: [S.FAILED, S.ABANDONED, S.EXPIRED],
  // Statuses that may expire after the 24h window with no confirmed payment.
  EXPIRABLE: [S.PENDING, S.VERIFICATION_PENDING, S.INITIALIZATION_UNKNOWN],
  // A retry with the same idempotency key may restart initialization from these.
  RETRYABLE_INIT: [S.INITIALIZATION_FAILED, S.INITIALIZATION_UNKNOWN, S.PENDING, S.VERIFICATION_PENDING],
  // The same key cannot be reused once the order is in one of these.
  CLOSED: [S.FAILED, S.ABANDONED, S.EXPIRED, S.REVIEW_REQUIRED]
};

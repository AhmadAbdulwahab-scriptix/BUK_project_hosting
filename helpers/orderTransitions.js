// Pure payment-state logic: no database, no network. That makes it easy to unit-test
// every branch of the "what does this Paystack result mean for this order?" decision.
const { ORDER_STATUS: S, IMMUTABLE, ACTIVE_RECONCILABLE } = require('../constants/orderStatus');

/**
 * Classifies a verified Paystack transaction against the saved order.
 * Returns: 'paid' | 'mismatch' | 'reversed' | 'failed' | 'abandoned' | 'pending'
 */
function classifyVerification(verified, order) {
  const detailsMatch = verified.reference === order.reference &&
    verified.currency === order.currency &&
    Number(verified.amount) === order.amountKobo;

  if (verified.status === 'success' && detailsMatch) return 'paid';
  if (!detailsMatch) return 'mismatch';
  if (verified.status === 'reversed') return 'reversed';
  if (verified.status === 'failed' || verified.status === 'abandoned') return verified.status;
  return 'pending';
}

/**
 * Applies a verified Paystack result to an order document (mutates it; caller saves).
 * Returns an outcome string. paid / refunded orders are never downgraded.
 */
function applyVerification(order, verified, now = new Date()) {
  if (order.status === S.PAID) return 'already-paid';
  if (order.status === S.REFUNDED) return 'refunded';

  const verdict = classifyVerification(verified, order);

  switch (verdict) {
    case 'paid':
      order.status = S.PAID;
      order.paystackTransactionId = verified.id;
      order.paymentChannel = verified.channel;
      order.paidAt = verified.paid_at ? new Date(verified.paid_at) : now;
      order.webhookVerifiedAt = now;
      order.failureReason = undefined;
      order.activeCheckoutEmail = undefined;
      return 'paid';

    case 'mismatch':
      order.status = S.REVIEW_REQUIRED;
      order.failureReason = 'Verified Paystack details did not match the saved order.';
      return 'review-required';

    case 'reversed':
      order.status = S.REVIEW_REQUIRED;
      order.failureReason = 'Paystack reports this transaction was reversed.';
      return 'review-required';

    case 'failed':
    case 'abandoned':
      order.status = verdict;
      order.failureReason = `Paystack verification returned ${verdict}.`;
      order.activeCheckoutEmail = undefined;
      return verdict;

    default: // pending
      order.lastVerifiedAt = now;
      // Only live orders move to verification_pending. Closed orders (failed, expired,
      // review_required) stay as they are, so the sweeper does not flip them back and forth
      // or re-take the email lock.
      if (ACTIVE_RECONCILABLE.includes(order.status)) {
        order.status = S.VERIFICATION_PENDING;
        order.activeCheckoutEmail = order.email;
      }
      return 'pending';
  }
}

/**
 * Marks a student as paid after successful payment. Returns true if student was updated.
 */
async function markStudentPaid(studentId, paidAt, reference) {
  const Student = require('../models/Student');
  if (!studentId) return false;
  const result = await Student.updateOne(
    { _id: studentId },
    { $set: { paid: true, paidAt, paymentReference: reference } }
  );
  return result.modifiedCount === 1;
}

module.exports = { classifyVerification, applyVerification, markStudentPaid, IMMUTABLE };

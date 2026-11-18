// Keeps MongoDB in agreement with Paystack: verify a reference, then commit the result atomically.
const mongoose = require('mongoose');
const config = require('../config');
const Order = require('../models/Order');
const WebhookReceipt = require('../models/WebhookReceipt');
const paystack = require('./paystack.service');
const { applyVerification, markStudentPaid } = require('../helpers/orderTransitions');
const { backoffDelay } = require('../helpers/payments');
const { mapWithConcurrency } = require('../utils/concurrency');
const logger = require('../utils/logger');
const { WEBHOOK_STATE } = require('../constants/webhookState');
const { ORDER_STATUS: S, ACTIVE_RECONCILABLE, LATE_CHECK, EXPIRABLE } = require('../constants/orderStatus');

/**
 * Atomically saves the order change and, when supplied, marks its webhook receipt processed.
 * Needs a replica set (MongoDB Atlas has one). The Paystack call happens BEFORE this, never inside it,
 * so the transaction stays short.
 */
async function commitVerifiedResult(orderId, verified, receiptId = null) {
  const session = await mongoose.startSession();
  let outcome = 'unchanged';
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new Error('Order disappeared during payment reconciliation.');

      outcome = applyVerification(order, verified);
      if (order.isModified()) await order.save({ session });

      // Mark student as paid if order was successfully paid
      if (outcome === 'paid' && order.selectedStudent) {
        await markStudentPaid(order.selectedStudent, order.paidAt, order.reference);
      }

      if (receiptId) {
        await WebhookReceipt.updateOne(
          { _id: receiptId },
          {
            $set: { state: WEBHOOK_STATE.PROCESSED, processedAt: new Date(), outcome, lastError: '' },
            $unset: { lockUntil: 1, nextAttemptAt: 1 }
          },
          { session }
        );
      }
    });
    return outcome;
  } finally {
    await session.endSession();
  }
}

async function verifyAndCommit(orderId, reference, { receiptId = null, timeoutMs } = {}) {
  const verified = await paystack.verifyTransaction(reference, { timeoutMs });
  return commitVerifiedResult(orderId, verified, receiptId);
}

async function reconcileReference(reference, { receiptId = null, timeoutMs } = {}) {
  if (!reference) return 'missing-reference';
  const order = await Order.findOne({ reference }).select('_id').lean();
  if (!order) return 'unknown-reference';
  return verifyAndCommit(order._id, reference, { receiptId, timeoutMs });
}

/* ------------------------------------------------------------------ *
 * Background sweep
 * ------------------------------------------------------------------ */

function dueQuery(now) {
  const lateSince = new Date(now.getTime() - config.reconcile.lateWindowMs);
  return {
    $and: [
      {
        $or: [
          { status: { $in: ACTIVE_RECONCILABLE } },
          // Closed orders are only re-checked for a limited window, so they eventually drop out.
          { status: { $in: LATE_CHECK }, createdAt: { $gt: lateSince } }
        ]
      },
      { $or: [{ nextReconcileAt: { $lte: now } }, { nextReconcileAt: null }] }
    ]
  };
}

// timestamps:false so scheduling writes do not change updatedAt (which other logic relies on).
const SCHEDULE_ONLY = { timestamps: false };

async function claim(candidate, now) {
  // Compare-and-set on the previous nextReconcileAt: only one process can win this order.
  const result = await Order.updateOne(
    { _id: candidate._id, nextReconcileAt: candidate.nextReconcileAt || null },
    { $set: { nextReconcileAt: new Date(now.getTime() + config.reconcile.leaseMs) } },
    SCHEDULE_ONLY
  );
  return result.modifiedCount === 1;
}

async function scheduleNext(candidate, isLate, resetAttempts) {
  const attempts = resetAttempts ? 0 : (candidate.reconcileAttempts || 0);
  const policy = isLate ? config.reconcile.lateBackoff : config.reconcile.activeBackoff;
  await Order.updateOne(
    { _id: candidate._id },
    {
      $set: {
        reconcileAttempts: attempts + 1,
        lastReconciledAt: new Date(),
        nextReconcileAt: new Date(Date.now() + backoffDelay(attempts, policy))
      }
    },
    SCHEDULE_ONLY
  );
}

// Paystack has never heard of this reference: the order never actually reached checkout.
async function closeNeverInitialized(candidate, now) {
  const result = await Order.updateOne(
    {
      _id: candidate._id,
      status: { $in: [S.INITIALIZING, S.INITIALIZATION_UNKNOWN] },
      updatedAt: { $lt: new Date(now.getTime() - config.order.initializationGiveUpMs) }
    },
    {
      $set: { status: S.INITIALIZATION_FAILED, failureReason: 'Checkout was never created at Paystack.' },
      $unset: { activeCheckoutEmail: 1 }
    }
  );
  return result.modifiedCount === 1;
}

const DONE_OUTCOMES = new Set(['paid', 'already-paid', 'refunded', 'review-required', 'initialization-closed']);
const LATE_OUTCOMES = new Set(['failed', 'abandoned', 'expired']);

async function reconcileDueOrder(candidate, now) {
  if (!(await claim(candidate, now))) return 'skipped';

  let outcome = 'error';
  try {
    outcome = await verifyAndCommit(candidate._id, candidate.reference);

    if (outcome === 'pending' && candidate.expiresAt && candidate.expiresAt < now) {
      const expired = await Order.updateOne(
        { _id: candidate._id, status: { $in: EXPIRABLE } },
        {
          $set: { status: S.EXPIRED, failureReason: 'Checkout expired after 24 hours without a confirmed successful payment.' },
          $unset: { activeCheckoutEmail: 1 }
        }
      );
      if (expired.modifiedCount === 1) outcome = 'expired';
    }
  } catch (error) {
    const neverInitialized = error instanceof paystack.PaystackError && error.isNotFound &&
      [S.INITIALIZING, S.INITIALIZATION_UNKNOWN].includes(candidate.status);
    if (neverInitialized && await closeNeverInitialized(candidate, now)) {
      outcome = 'initialization-closed';
    } else {
      // Leave uncertain orders untouched; they are retried later with backoff.
      logger.warn(`Reconciliation deferred for ${candidate.reference}:`, error.message);
    }
  }

  if (!DONE_OUTCOMES.has(outcome)) {
    const wasLate = LATE_CHECK.includes(candidate.status);
    const isLate = wasLate || LATE_OUTCOMES.has(outcome);
    await scheduleNext(candidate, isLate, isLate && !wasLate);
  }
  return outcome;
}

/**
 * One sweep: fetch the orders that are DUE (oldest due-time first, so nothing starves),
 * verify them in parallel with a concurrency cap, and reschedule each with backoff.
 */
async function sweepOrders(now = new Date()) {
  const due = await Order.find(dueQuery(now))
    .sort({ nextReconcileAt: 1 })
    .limit(config.reconcile.batchSize)
    .select('_id reference status expiresAt updatedAt nextReconcileAt reconcileAttempts')
    .lean();
  if (due.length === 0) return { due: 0 };

  const results = await mapWithConcurrency(due, config.reconcile.concurrency, c => reconcileDueOrder(c, now));
  const summary = {};
  for (const r of results) {
    const key = r.ok ? r.value : 'error';
    summary[key] = (summary[key] || 0) + 1;
    if (!r.ok) logger.error('Order sweep error:', r.error.message);
  }
  logger.info(`Order sweep: ${due.length} due`, summary);
  return { due: due.length, summary };
}

module.exports = { commitVerifiedResult, verifyAndCommit, reconcileReference, sweepOrders };

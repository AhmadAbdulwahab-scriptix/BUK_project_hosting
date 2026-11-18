// Business rules for creating a payment attempt and reading an order. No req/res in here.
const config = require('../config');
const Order = require('../models/Order');
const Student = require('../models/Student');
const paystack = require('./paystack.service');
const AppError = require('../utils/AppError');
const { calculatePrice, makeReference, fingerprint, REFERENCE_PATTERN } = require('../helpers/payments');
const { ORDER_STATUS: S, IMMUTABLE, CLOSED, RETRYABLE_INIT } = require('../constants/orderStatus');

const reuse = order => ({ authorizationUrl: order.authorizationUrl, reference: order.reference, reused: true });
const preparing = () => new AppError(409, 'This payment attempt is already being prepared. Wait briefly and refresh before retrying.');

// Two different keys, same email: the unique activeCheckoutEmail index rejected the second one.
async function emailConflict(email, original) {
  const active = await Order.findOne({ activeCheckoutEmail: email }).select('reference').lean();
  if (!active) return original;
  return new AppError(409, 'There is already an active checkout for this email. Check its status before starting another payment.', {
    reference: active.reference,
    statusUrl: `/order?reference=${encodeURIComponent(active.reference)}`
  });
}

// Decide what an existing order with this key means: reuse it, reject, or (null) restart initialization.
function checkExisting(order, requestFingerprint) {
  if (order.requestFingerprint !== requestFingerprint) {
    throw new AppError(409, 'This payment attempt key belongs to different form details. Start a new attempt.');
  }
  if (order.authorizationUrl && [S.PENDING, S.VERIFICATION_PENDING].includes(order.status)) return reuse(order);
  if (order.status === S.INITIALIZING && Date.now() - order.updatedAt.getTime() < config.order.initializingStaleMs) throw preparing();
  if (IMMUTABLE.includes(order.status)) throw new AppError(409, 'This payment attempt has already been completed.');
  if (CLOSED.includes(order.status)) {
    throw new AppError(409, 'This payment attempt is closed or requires review. Check its order page before starting a new attempt.');
  }
  return null;
}

async function createOrder({ domain, email, fullName, idempotencyKey, requestFingerprint, studentRegNumber }) {
  // Look up the student by registration number
  const student = await Student.findOne({ registrationNumber: studentRegNumber });
  if (!student) throw new AppError(400, 'Invalid student registration number. Please start a new payment attempt.');

  // Check if student has already paid
  if (student.paid) {
    throw new AppError(409, 'This student has already completed payment. No further payment is required.', {
      paidAt: student.paidAt,
      paymentReference: student.paymentReference
    });
  }

  const price = calculatePrice(domain); // the server decides the price, never the browser
  try {
    return { order: await Order.create({
      reference: makeReference(), idempotencyKey, requestFingerprint, activeCheckoutEmail: email,
      customerName: fullName, email, selectedDomain: domain, selectedStudent: student._id,
      totalUsd: price.totalUsd, amountNaira: price.amountNaira, amountKobo: price.amountKobo,
      currency: 'NGN', status: S.INITIALIZING, expiresAt: new Date(Date.now() + config.order.lifetimeMs)
    }) };
  } catch (error) {
    if (error.code !== 11000) throw error;
    // Either a parallel request with the same key beat us, or the email already has an active checkout.
    const raced = await Order.findOne({ idempotencyKey });
    if (!raced) throw await emailConflict(email, error);
    if (raced.requestFingerprint !== requestFingerprint) throw error;
    if (raced.authorizationUrl) return { response: reuse(raced) };
    throw preparing();
  }
}

// Atomic claim: if two retries arrive together, exactly one gets the order and calls Paystack.
async function claimForInitialization(order, email) {
  const staleBefore = new Date(Date.now() - config.order.initializingStaleMs);
  try {
    const claimed = await Order.findOneAndUpdate(
      {
        _id: order._id,
        $or: [{ status: { $in: RETRYABLE_INIT } }, { status: S.INITIALIZING, updatedAt: { $lt: staleBefore } }]
      },
      {
        $set: { status: S.INITIALIZING, activeCheckoutEmail: email, reconcileAttempts: 0, nextReconcileAt: new Date(Date.now() + config.order.initializingStaleMs) },
        $unset: { failureReason: 1 }
      },
      { new: true }
    );
    if (!claimed) throw preparing();
    return claimed;
  } catch (error) {
    if (error.code === 11000) throw await emailConflict(email, error);
    throw error;
  }
}

async function callPaystack(order) {
  for (let attempt = 0; ; attempt++) {
    try {
      const data = await paystack.initializeTransaction(order);
      order.authorizationUrl = data.authorization_url;
      order.accessCode = data.access_code;
      order.status = S.PENDING;
      await order.save();
      return { authorizationUrl: order.authorizationUrl, reference: order.reference };
    } catch (error) {
      // An earlier ambiguous attempt may have reached Paystack. Its checkout link never reached the
      // customer, so nobody can pay it: safe to give this order a fresh reference and try once more.
      if (attempt === 0 && error.isDuplicateReference) { order.reference = makeReference(); continue; }

      const ambiguous = error instanceof paystack.PaystackError ? error.ambiguous : true;
      order.status = ambiguous ? S.INITIALIZATION_UNKNOWN : S.INITIALIZATION_FAILED;
      if (!ambiguous) order.activeCheckoutEmail = undefined;
      order.failureReason = String(error.message).slice(0, 500);
      await order.save();
      throw new AppError(502, 'We could not confirm checkout initialization. Retry using the same form attempt; do not create a new payment.');
    }
  }
}

async function initializePayment({ domain, email, fullName, idempotencyKey, studentId }) {
  const requestFingerprint = fingerprint({ domain, email, fullName });
  const existing = await Order.findOne({ idempotencyKey });

  let order;
  if (existing) {
    const reusable = checkExisting(existing, requestFingerprint);
    if (reusable) return reusable;
    order = await claimForInitialization(existing, email);
  } else {
    const created = await createOrder({ domain, email, fullName, idempotencyKey, requestFingerprint, studentRegNumber: studentId });
    if (created.response) return created.response;
    order = created.order;
  }
  return callPaystack(order);
}

async function getOrderStatus(reference) {
  if (!REFERENCE_PATTERN.test(reference)) throw new AppError(404, 'Order not found.');
  const order = await Order.findOne({ reference }).select(
    'reference selectedDomain totalUsd amountNaira currency status createdAt updatedAt paidAt expiresAt failureReason selectedStudent'
  ).lean();
  if (!order) throw new AppError(404, 'Order not found.');
  // Populate student details if selected
  if (order.selectedStudent) {
    const student = await Student.findById(order.selectedStudent).select('name registrationNumber').lean();
    order.student = student;
  }
  return order;
}

module.exports = { initializePayment, getOrderStatus };

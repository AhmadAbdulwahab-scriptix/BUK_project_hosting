const mongoose = require('mongoose');
const { ALL_STATUSES, ORDER_STATUS } = require('../constants/orderStatus');
const config = require('../config');

const orderSchema = new mongoose.Schema({
  // unique: true already creates an index, so no extra index: true here.
  reference: { type: String, required: true, unique: true },
  idempotencyKey: { type: String, unique: true, sparse: true },
  activeCheckoutEmail: { type: String, unique: true, sparse: true },
  requestFingerprint: String,
  customerName: { type: String, required: true, trim: true },
  selectedStudent: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  email: { type: String, required: true, lowercase: true, trim: true },
  selectedDomain: { type: String, required: true, enum: ['com', 'ng'] },
  totalUsd: { type: Number, required: true },
  amountNaira: { type: Number, required: true },
  amountKobo: { type: Number, required: true },
  currency: { type: String, default: 'NGN', required: true },
  status: { type: String, enum: ALL_STATUSES, default: ORDER_STATUS.PENDING },
  authorizationUrl: String,
  accessCode: String,
  paystackTransactionId: Number,
  paymentChannel: String,
  paidAt: Date,
  expiresAt: Date,
  failureReason: String,
  webhookVerifiedAt: Date,
  lastVerifiedAt: Date,
  refundReference: String,
  refundedAt: Date,
  refundReason: String,

  // Reconciliation schedule: the sweeper only picks orders whose time has come, and
  // backs off after each check, so old closed orders can never crowd out new pending ones.
  reconcileAttempts: { type: Number, default: 0 },
  lastReconciledAt: Date,
  nextReconcileAt: { type: Date, default: () => new Date(Date.now() + config.order.initializingStaleMs) }
}, { timestamps: true });

// Sweeper: "due orders by status".  Admin list: "newest first, optionally by status".
orderSchema.index({ status: 1, nextReconcileAt: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);

const mongoose = require('mongoose');
const Order = require('../models/Order');
const Student = require('../models/Student');
const AdminAudit = require('../models/AdminAudit');
const reconciliation = require('./reconciliation.service');
const { PaystackError } = require('./paystack.service');
const AppError = require('../utils/AppError');
const { ALL_STATUSES, ORDER_STATUS: S } = require('../constants/orderStatus');

const ACTOR = 'admin-api';

async function listOrders({ status, limit }) {
  const filter = {};
  if (status) {
    if (!ALL_STATUSES.includes(status)) throw new AppError(400, 'Invalid status filter.');
    filter.status = status;
  }
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(safeLimit)
    .select('reference customerName email selectedDomain totalUsd amountNaira amountKobo currency status createdAt updatedAt paidAt expiresAt failureReason refundReference refundedAt selectedStudent')
    .lean();

  // Populate student information for each order
  const orderIds = orders.map(o => o.selectedStudent).filter(Boolean);
  const students = await Student.find({ _id: { $in: orderIds } }).select('name registrationNumber paid').lean();
  const studentMap = new Map(students.map(s => [s._id.toString(), s]));

  const ordersWithStudents = orders.map(order => ({
    ...order,
    student: order.selectedStudent ? studentMap.get(order.selectedStudent.toString()) : null
  }));

  return { count: ordersWithStudents.length, orders: ordersWithStudents };
}

async function reconcileOrder(reference) {
  let outcome;
  try {
    outcome = await reconciliation.reconcileReference(reference);
  } catch (error) {
    if (error instanceof PaystackError) throw new AppError(502, 'Could not reconcile this payment with Paystack.');
    throw error;
  }
  if (outcome === 'unknown-reference' || outcome === 'missing-reference') throw new AppError(404, 'Order not found.');
  await AdminAudit.create({ action: 'manual_reconciliation', reference, actor: ACTOR, details: { outcome } });
  return { reference, outcome };
}

async function recordRefund(reference, { reason, refundReference }) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ reference }).session(session);
      if (!order) throw new AppError(404, 'Order not found.');
      if (![S.PAID, S.REFUND_PENDING].includes(order.status)) throw new AppError(409, 'Only paid orders can be recorded as refunded.');
      order.status = S.REFUNDED;
      order.activeCheckoutEmail = undefined;
      order.refundReference = refundReference;
      order.refundReason = reason;
      order.refundedAt = new Date();
      await order.save({ session });
      await AdminAudit.create([{ action: 'refund_recorded', reference, actor: ACTOR, details: { refundReference, reason } }], { session });
    });
  } finally {
    await session.endSession();
  }
  return { reference, status: S.REFUNDED };
}

module.exports = { listOrders, reconcileOrder, recordRefund };

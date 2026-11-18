const adminService = require('../services/admin.service');
const { validateRefund } = require('../validators/payment.validator');
const asyncHandler = require('../utils/asyncHandler');

const listOrders = asyncHandler(async (req, res) => {
  res.json(await adminService.listOrders({ status: req.query.status, limit: req.query.limit }));
});

const reconcileOrder = asyncHandler(async (req, res) => {
  res.json(await adminService.reconcileOrder(req.params.reference));
});

const recordRefund = asyncHandler(async (req, res) => {
  res.json(await adminService.recordRefund(req.params.reference, validateRefund(req.body)));
});

module.exports = { listOrders, reconcileOrder, recordRefund };

const path = require('path');
const orderService = require('../services/order.service');
const asyncHandler = require('../utils/asyncHandler');

const statusPage = (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'order.html'));

const getStatus = asyncHandler(async (req, res) => {
  res.json({ order: await orderService.getOrderStatus(req.params.reference) });
});

module.exports = { statusPage, getStatus };

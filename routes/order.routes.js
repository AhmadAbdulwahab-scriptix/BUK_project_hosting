const router = require('express').Router();
const controller = require('../controllers/order.controller');
const rateLimit = require('../middleware/rateLimit');
const requireDatabase = require('../middleware/requireDatabase');
const { rateLimit: limits } = require('../config');

router.get('/order', controller.statusPage);
router.get('/api/orders/:reference/status', rateLimit(limits.status), requireDatabase, controller.getStatus);

module.exports = router;

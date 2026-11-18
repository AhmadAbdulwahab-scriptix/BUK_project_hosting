const router = require('express').Router();
const controller = require('../controllers/payment.controller');
const rateLimit = require('../middleware/rateLimit');
const requireDatabase = require('../middleware/requireDatabase');
const { rateLimit: limits } = require('../config');

router.get('/api/config', controller.getConfig);
router.post('/api/paystack/initialize', rateLimit(limits.initialize), requireDatabase, controller.initialize);
router.get('/payment/callback', rateLimit(limits.callback), controller.callback);

module.exports = router;

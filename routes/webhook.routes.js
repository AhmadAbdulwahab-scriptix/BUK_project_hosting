const express = require('express');
const router = express.Router();
const { handlePaystackWebhook } = require('../controllers/webhook.controller');

// Raw bytes are required so the HMAC is calculated over exactly what Paystack signed.
router.post('/', express.raw({ type: 'application/json', limit: '1mb' }), handlePaystackWebhook);

module.exports = router;

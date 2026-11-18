const router = require('express').Router();
const controller = require('../controllers/admin.controller');
const studentController = require('../controllers/student.controller');
const rateLimit = require('../middleware/rateLimit');
const requireAdmin = require('../middleware/requireAdmin');
const requireDatabase = require('../middleware/requireDatabase');
const { rateLimit: limits } = require('../config');

// Rate limit first so wrong tokens cannot be guessed quickly.
router.use(rateLimit(limits.admin), requireAdmin, requireDatabase);
router.get('/orders', controller.listOrders);
router.post('/orders/:reference/reconcile', controller.reconcileOrder);
router.post('/orders/:reference/refund-record', controller.recordRefund);
router.get('/students', studentController.listStudents);
router.get('/students/:regNumber/paid-status', studentController.getPaidStatus);

module.exports = router;
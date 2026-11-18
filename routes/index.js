const router = require('express').Router();

router.use(require('./payment.routes'));
router.use(require('./order.routes'));
router.use('/api/admin', require('./admin.routes'));

module.exports = router;

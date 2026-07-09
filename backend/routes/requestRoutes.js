const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');

router.post('/', auth, requestController.create);
router.get('/mine', auth, requestController.mine);
router.get('/', auth, checkRole(['logistics_chief', 'admin', 'superadmin']), requestController.all);
router.patch('/:id/status', auth, checkRole(['logistics_chief', 'admin', 'superadmin']), requestController.updateStatus);
router.patch('/:id/cancel', auth, requestController.cancel);
router.patch('/:id/reschedule/respond', auth, requestController.respondReschedule);
router.put('/:id', auth, requestController.update);

module.exports = router;
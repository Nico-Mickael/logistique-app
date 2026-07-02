const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');

router.post('/', auth, requestController.create);
router.get('/mine', auth, requestController.mine);
router.get('/', auth, checkRole(['logistics_chief', 'admin']), requestController.all);
router.patch('/:id/status', auth, checkRole(['logistics_chief', 'admin']), requestController.updateStatus);

module.exports = router;
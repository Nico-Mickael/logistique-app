const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middlewares/auth');

router.get('/mine', auth, notificationController.mine);
router.patch('/read-all', auth, notificationController.markAllRead);
router.patch('/:id/read', auth, notificationController.markAsRead);

module.exports = router;
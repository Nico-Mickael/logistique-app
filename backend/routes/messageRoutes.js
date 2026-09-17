const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middlewares/auth');

// Toutes les routes de messagerie nécessitent une authentification JWT.
router.use(auth);

router.get('/unread-count', messageController.unreadBadgeCount);
router.patch('/:id', messageController.update);
router.delete('/:id', messageController.remove);

module.exports = router;
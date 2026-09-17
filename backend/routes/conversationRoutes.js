const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const auth = require('../middlewares/auth');

// Toutes les routes de messagerie nécessitent une authentification JWT.
router.use(auth);

router.get('/users', conversationController.users);
router.post('/:id/read', conversationController.markRead);
router.post('/:id/messages', conversationController.send);
router.get('/:id/messages', conversationController.messages);
router.post('/', conversationController.create);
router.get('/:id', conversationController.detail);
router.get('/', conversationController.list);

module.exports = router;
const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushController');
const auth = require('../middlewares/auth');

// La configuration (clé VAPID publique) n'exige pas d'authentification.
router.get('/config', pushController.config);
router.get('/subscriptions', auth, pushController.list);
router.post('/subscribe', auth, pushController.subscribe);
router.delete('/subscribe', auth, pushController.unsubscribe);
router.post('/test', auth, pushController.sendTest);

module.exports = router;
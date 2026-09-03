const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');
const { rateLimit } = require('../middlewares/rateLimiter');

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Trop de tentatives de connexion, réessayez dans 15 minutes' });

router.post('/register', auth, checkRole(['superadmin']), authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', auth, authController.logout);
router.post('/logout-all', auth, authController.logoutAll);
router.get('/me', auth, authController.me);
router.get('/sessions', auth, authController.sessions);
router.delete('/sessions/:id', auth, authController.revokeSession);

module.exports = router;

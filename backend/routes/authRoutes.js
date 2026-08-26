const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');

router.post('/register', auth, checkRole(['superadmin']), authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', auth, authController.logout);
router.post('/logout-all', auth, authController.logoutAll);
router.get('/me', auth, authController.me);
router.get('/sessions', auth, authController.sessions);
router.delete('/sessions/:id', auth, authController.revokeSession);

module.exports = router;

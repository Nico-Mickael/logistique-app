const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');

router.post('/register', auth, checkRole(['superadmin']), authController.register);
router.post('/login', authController.login);
router.get('/me', auth, authController.me);

module.exports = router;
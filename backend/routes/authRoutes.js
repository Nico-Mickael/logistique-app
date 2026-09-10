const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');
const { rateLimit } = require('../middlewares/rateLimiter');

// Anti-brute-force en deux couches :
//  - par IP : plafond global généreux (une IP ne bloque plus tout le bâtiment) ;
//  - par compte (email + IP) : plafond strict, contre les attaques ciblées
//    par force brute sur un identifiant donné.
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Trop de tentatives de connexion, réessayez dans 15 minutes',
});

const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Trop de tentatives pour ce compte, réessayez dans 15 minutes',
  keyGenerator: (req) => `${req.ip}|${String(req.body?.email || '').trim().toLowerCase()}`,
});

router.post('/register', auth, checkRole(['superadmin']), authController.register);
router.post('/login', loginIpLimiter, loginAccountLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', auth, authController.logout);
router.post('/logout-all', auth, authController.logoutAll);
router.get('/me', auth, authController.me);
router.get('/sessions', auth, authController.sessions);
router.delete('/sessions', auth, authController.deleteSessions);
router.delete('/sessions/:id', auth, authController.revokeSession);

module.exports = router;

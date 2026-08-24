const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');
const { CHIEF_ROLES } = require('../utils/constants');

// Accessible à tout utilisateur connecté : uniquement SES statistiques
router.get('/mine', auth, statsController.mine);

router.use(auth, checkRole(CHIEF_ROLES));

router.get('/overview', statsController.overview);
router.get('/kilometrage', statsController.kilometrage);

module.exports = router;

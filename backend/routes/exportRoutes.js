const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');
const { CHIEF_ROLES } = require('../utils/constants');

router.use(auth, checkRole(CHIEF_ROLES));

router.get('/fleet', exportController.fleetReport);
router.get('/sorties', exportController.sortiesReport);
router.get('/maintenance', exportController.maintenanceReport);

module.exports = router;

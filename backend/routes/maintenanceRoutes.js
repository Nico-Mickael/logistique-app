const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');
const { CHIEF_ROLES } = require('../utils/constants');

router.use(auth, checkRole(CHIEF_ROLES));

router.get('/', maintenanceController.list);
router.get('/due', maintenanceController.due);
router.post('/', maintenanceController.create);
router.patch('/:id', maintenanceController.update);
router.delete('/:id', maintenanceController.remove);
router.patch('/sorties/:id/fuel', maintenanceController.recordFuel);

module.exports = router;

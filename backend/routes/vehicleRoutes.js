const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');
const { CHIEF_ROLES } = require('../utils/constants');

router.get('/', auth, vehicleController.getAll);
router.get('/available', auth, vehicleController.getAvailable);
router.get('/occupancy', auth, vehicleController.getOccupancy);
router.post('/', auth, checkRole(CHIEF_ROLES), vehicleController.create);
router.patch('/:id', auth, checkRole(CHIEF_ROLES), vehicleController.update);
router.delete('/:id', auth, checkRole(CHIEF_ROLES), vehicleController.remove);

module.exports = router;

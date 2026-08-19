const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');

router.get('/', auth, vehicleController.getAll);
router.get('/available', auth, vehicleController.getAvailable);
router.get('/occupancy', auth, vehicleController.getOccupancy);
router.post('/', auth, checkRole(['logistics_chief', 'admin', 'superadmin']), vehicleController.create);
router.patch('/:id', auth, checkRole(['logistics_chief', 'admin', 'superadmin']), vehicleController.update);

module.exports = router;
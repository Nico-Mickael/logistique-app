const express = require('express');
const router = express.Router();
const sortieController = require('../controllers/sortieController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');

router.get('/mine', auth, sortieController.mine);
router.patch('/:id/return', auth, sortieController.employeeReturn);

router.use(auth, checkRole(['logistics_chief', 'admin', 'superadmin']));

router.get('/', sortieController.getAll);
router.get('/last/:vehicleId', sortieController.lastForVehicle);
router.post('/', sortieController.create);
router.get('/:id/suggestions', sortieController.suggestions);
router.post('/:id/add-request', sortieController.addRequest);
router.patch('/:id/status', sortieController.updateStatus);
router.patch('/:id/depart', sortieController.depart);
router.patch('/:id/arrivee', sortieController.arrivee);
router.patch('/:id/validate-return', sortieController.validateReturn);
router.put('/:id', sortieController.update);
router.delete('/:id', sortieController.remove);

module.exports = router;

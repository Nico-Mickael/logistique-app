const express = require('express');
const router = express.Router();
const sortieController = require('../controllers/sortieController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');

router.use(auth, checkRole(['logistics_chief', 'admin']));

router.get('/', sortieController.getAll);
router.post('/', sortieController.create);
router.get('/:id/suggestions', sortieController.suggestions);
router.post('/:id/add-request', sortieController.addRequest);
router.patch('/:id/status', sortieController.updateStatus);
router.patch('/:id/depart', sortieController.depart);
router.patch('/:id/arrivee', sortieController.arrivee);

module.exports = router;
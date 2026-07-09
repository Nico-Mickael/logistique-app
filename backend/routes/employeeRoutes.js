const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');

router.use(auth, checkRole(['superadmin']));

router.get('/', employeeController.list);
router.post('/', employeeController.create);
router.put('/:id', employeeController.update);
router.delete('/:id', employeeController.remove);

module.exports = router;

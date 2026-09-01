const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');
const { CHIEF_ROLES } = require('../utils/constants');

// Liste des comptes 'chauffeur' (pour l'affectation d'un chauffeur à une sortie)
router.get('/chauffeurs', auth, checkRole(CHIEF_ROLES), employeeController.listChauffeurs);

router.use(auth, checkRole(['superadmin']));

router.get('/', employeeController.list);
router.post('/', employeeController.create);
router.put('/:id', employeeController.update);
router.delete('/:id', employeeController.remove);

module.exports = router;

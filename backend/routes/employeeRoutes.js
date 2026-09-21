const express = require('express');
const multer = require('multer');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');
const { CHIEF_ROLES } = require('../utils/constants');

// Fichier Excel/CSV gardé en mémoire (jamais écrit sur disque), 5 Mo max.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Liste des comptes 'chauffeur' (pour l'affectation d'un chauffeur à une sortie)
router.get('/chauffeurs', auth, checkRole(CHIEF_ROLES), employeeController.listChauffeurs);

router.use(auth, checkRole(['superadmin']));

router.get('/', employeeController.list);
router.post('/', employeeController.create);

// Import en masse depuis un fichier Excel/CSV.
router.post('/import', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ message: 'Fichier invalide ou trop volumineux (max 5 Mo)' });
    next();
  });
}, employeeController.importUsers);

router.put('/:id', employeeController.update);
router.delete('/:id', employeeController.remove);

module.exports = router;

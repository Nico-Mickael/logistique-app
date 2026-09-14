const express = require('express');
const router = express.Router();
const siteController = require('../controllers/siteController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');

// Liste des sites : tout utilisateur connecté (affichage du site / sélecteur)
router.get('/', auth, siteController.list);

// CRUD sites : Superadmin uniquement
router.use(auth, checkRole(['superadmin']));

router.post('/', siteController.create);
router.put('/:id', siteController.update);
router.delete('/:id', siteController.remove);

module.exports = router;
const express = require('express');
const router = express.Router();
const multer = require('multer');
const importController = require('../controllers/importController');
const auth = require('../middlewares/auth');
const checkRole = require('../middlewares/checkRole');

const upload = multer({ storage: multer.memoryStorage() });

router.use(auth, checkRole(['superadmin']));

router.get('/templates', importController.templates);
router.post('/analyze', upload.single('file'), importController.analyze);
router.post('/execute', upload.single('file'), importController.execute);

module.exports = router;

const express = require('express');
const router = express.Router();
const multer = require('multer');
const importsController = require('../controllers/imports');
const { protect } = require('../middlewares/auth');

// Setup multer for memory storage (for parsing CSV/XLSX before saving)
const upload = multer({ storage: multer.memoryStorage() });

router.post('/preview', protect, upload.single('file'), importsController.previewImport);
router.post('/validate', protect, upload.single('file'), importsController.validateImport);
router.post('/commit', protect, importsController.commitImport);
router.get('/', protect, importsController.getImports);
router.get('/:id', protect, importsController.getImportById);

module.exports = router;

const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysis');
const { protect } = require('../middlewares/auth');

router.post('/:id/analyze', protect, analysisController.analyzeLeadWebsite);
router.get('/:id/audit', protect, analysisController.getLeadAudit);

module.exports = router;

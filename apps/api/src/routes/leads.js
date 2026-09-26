const express = require('express');
const router = express.Router();
const leadsController = require('../controllers/leads');
const { protect } = require('../middlewares/auth');

router.get('/', protect, leadsController.getLeads);
router.get('/export', protect, leadsController.exportLeads);
router.get('/:id', protect, leadsController.getLeadById);
router.patch('/:id', protect, leadsController.updateLead);
router.delete('/:id', protect, leadsController.deleteLead);

module.exports = router;

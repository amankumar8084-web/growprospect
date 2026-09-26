const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard');
const { protect } = require('../middlewares/auth');

router.get('/', protect, dashboardController.getDashboardMetrics);

module.exports = router;

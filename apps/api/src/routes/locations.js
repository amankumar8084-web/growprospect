const express = require('express');
const router = express.Router();
const locationsController = require('../controllers/locations');
const { protect } = require('../middlewares/auth');

router.get('/countries', protect, locationsController.getCountries);
router.get('/states', protect, locationsController.getStates);
router.get('/cities', protect, locationsController.getCities);

module.exports = router;

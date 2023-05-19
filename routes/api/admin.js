const express = require('express');
const router = express.Router();

const adminController = require('../../controllers/AdminController');

router.post('/access-count', adminController.getAccessCount);
router.post('/give-license-key', adminController.giveLicenseKey);

module.exports = router;
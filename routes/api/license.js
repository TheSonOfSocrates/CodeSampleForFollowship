const express = require('express');
const router = express.Router();

const licenseController = require('../../controllers/LicenseController');
const authController = require('../../controllers/AuthController');

router.post('/check-license-validation', licenseController.checkLicenseValidation);
router.post('/get-license-info', authController.isAuthorized, licenseController.getLicenseInfo);
router.post('/expire-license-key', authController.isAuthorized, licenseController.expireLicenseKey);
module.exports = router;
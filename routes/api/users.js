const express = require('express');
const router = express.Router();

const authController = require('../../controllers/AuthController');
const userController = require('../../controllers/UserController');
const auth = require('../../controllers/AuthController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/change-password', auth.isAuthorized, authController.changePassword);
router.post('/check-password', auth.isAuthorized, authController.checkPassword);
router.post('/check-token', authController.checkToken);
router.post('/verify', authController.verifyEmail);

router.get('/getAllUsers', userController.getAllUsers);
router.post('/update', userController.updateUser);
router.post('/delete', userController.deleteUser);

router.post('/email', userController.sendEmail);

router.post('/send-notifications', auth.isAuthorized, userController.sendNotifications);
router.get('/get-notifications', auth.isAuthorized, userController.getNotifications);
router.post('/delete-notifications', auth.isAuthorized, userController.deleteNotifications);
router.post('/view-notification', auth.isAuthorized, userController.viewNotification);
router.post('/view-all-notification', auth.isAuthorized, userController.viewAllNotification);

module.exports = router;

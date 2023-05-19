const express = require('express');
const router = express.Router();

const priceController = require('../../controllers/PriceController');
const auth = require('../../controllers/AuthController');

router.post('/plans', priceController.getPlans);
router.post('/payment-info', auth.isAuthorized, priceController.getPaymentInfo);
router.post('/cancel-order', auth.isAuthorized, priceController.cancelOrder);

router.post('/stripe/create-payment-intent', auth.isAuthorized, priceController.createStripePaymentIntent);
router.post('/stripe/webhook', priceController.stripeWebhook);

router.post('/paypal/confirm-payment', auth.isAuthorized, priceController.confirmPaypalPayment);

router.post('/coinpayments/get-coin-list', auth.isAuthorized, priceController.getCoinList);
router.post('/coinpayments/create-transaction', auth.isAuthorized, priceController.createTransaction);
router.post('/coinpayments/webhook', priceController.coinpaymentsWebhook);

module.exports = router;
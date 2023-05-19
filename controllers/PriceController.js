const User = require('../models/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const LicenseController = require('./LicenseController');
const Plan = require('../models/Plan');
const SocketServer = require('../socket');
const axios = require('axios');
const qs = require('qs');
const { client } = require('../utils/coinPaymentAuth');
const crypto = require('crypto');
const { addNewNotification } = require('../utils/freqUtils');

exports.getPlans = async (req, res) => {
  const plans = await Plan.find();

  return res.json({
    success: true,
    plans
  });
};

exports.getPaymentInfo = async (req, res) => {
  const user = req.user;

  let paymentStatus = 'Not';
  let planId = '';
  if (user !== null) {
    paymentStatus = user.paymentStatus;
    planId = user.planId;
  }

  return res.json({
    success: true,
    paymentStatus,
    planId
  });
};

exports.cancelOrder = async (req, res) => {
  let user = req.user;

  if (user !== undefined && user !== null) {
    user.paymentStatus = 'Not';
    user.licenseExpireAt = null;
    user.planId = null;
    await user.save();

    addNewNotification(user, 'Your order canceled successfully.');
  } else {
    return res.json({
      success: false
    });
  }

  return res.json({
    success: true
  });
};

exports.createStripePaymentIntent = async (req, res) => {
  const options = {
    payment_method_types: req.body.payment_method_types,
    amount: req.body.amount * 100,
    currency: 'USD'
  };

  try {
    const paymentIntent = await stripe.paymentIntents.create(options);

    let user = req.user;
    user.paymentStatus = 'Ordered';
    user.paymentIntent = paymentIntent;
    user.planId = req.body.planId;
    user.licensePeriod = req.body.licensePeriod;
    user.save();

    return res.json({ success: true, message: 'Ordered successfully.', paymentIntent });
  } catch (err) {
    res.json(err);
  }
};

exports.stripeWebhook = async (req, res) => {
  let data;
  let eventType;
  // Check if webhook signing is configured.
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;
    let signature = req.headers['stripe-signature'];

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(`⚠️ Webhook signature verification failed.`);
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    data = event.data;
    eventType = event.type;
  } else {
    // Webhook signing is recommended, but if the secret is not configured in `config.js`,
    // retrieve the event data directly from the request body.
    data = req.body.data;
    eventType = req.body.type;
  }

  const clientSecret = data.object.client_secret;
  let user = await User.findOne({ 'paymentIntent.client_secret': clientSecret });

  if (user === null) {
    res.sendStatus(404);
    return;
  }

  if (user.paymentStatus === 'Purchased') {
    res.sendStatus(200);
  }

  if (eventType === 'payment_intent.succeeded') {
    // Fulfill any orders, e-mail receipts, etc
    const status = data.object.status;
    const amountReceived = data.object.amount_received;
    const currency = data.object.currency;

    const plan = await Plan.findOne({ '_id': user.planId });

    let totalAmount = 0;
    if (user.licensePeriod === 1) {
      totalAmount = user.licensePeriod * plan.price_monthly;
    } else {
      totalAmount = user.licensePeriod * plan.price_yearly;
    }

    if (currency === 'usd' && totalAmount * 100 === amountReceived && status === 'succeeded') {
      console.log('💰 Payment received!');
      const licenseKey = await LicenseController.generateLicense(user.email, user.licensePeriod);
      const paymentStatus = 'Purchased';
      user.paymentStatus = paymentStatus;
      user.licenseKey = licenseKey;

      let date = new Date();
      date.setUTCMonth(date.getUTCMonth() + user.licensePeriod);
      user.licenseExpireAt = date;

      await user.save();

      SocketServer.getInstance().sendMsg2Client(user.accessToken, 'payment', { paymentStatus, licenseKey });
    }

    return new Response('Success', {
      status: 200
    });
  } else if (eventType === 'payment_intent.payment_failed') {
    console.log('❌ Payment failed.');

    const paymentStatus = 'Not';
    const licenseKey = '';
    user.paymentStatus = paymentStatus;
    user.licenseKey = licenseKey;
    user.licenseExpireAt = null;
    await user.save();

    SocketServer.getInstance().sendMsg2Client(user.accessToken, 'payment', { paymentStatus, licenseKey });
  }

  res.sendStatus(200);
};

exports.confirmPaypalPayment = async (req, res) => {
  try {
    const baseURL = 'https://api.sandbox.paypal.com';

    let instance = axios.create({
      baseURL
    });

    let connectCnt = 0;

    instance.interceptors.response.use(
      function(result) {
        return checkPaypalPayment(req, res, result);
      },

      async function(error) {
        if (error.response.status === 401 && connectCnt < 5) {
          paypalAccessToken = await getNewAccessToken(baseURL);
          if (paypalAccessToken === 'fail') {
            SocketServer.getInstance().sendMsg2Client(req.user.accessToken, 'payment', {
              paymentStatus: 'Not',
              linceseKey: '',
              msg: 'Failed to get access token. Please contact to TG support.'
            });
          } else {
            connectCnt++;
            return getPaymentIntent(req, res, instance);
          }
        }
        SocketServer.getInstance().sendMsg2Client(req.user.accessToken, 'payment', {
          paymentStatus: 'Not',
          linceseKey: '',
          msg: 'Can\'t get payment intent. Please contact to TG support.'
        });
      }
    );

    getPaymentIntent(req, res, instance);
  } catch (msg) {
    return res.json({ success: false, msg });
  }
};

async function checkPaypalPayment(req, res, result) {
  const plan = await Plan.findOne({ '_id': req.body.selectedPlanId });

  let totalAmount;
  if (req.body.licensePeriod === 1) {
    totalAmount = req.body.licensePeriod * plan.price_monthly;
  } else {
    totalAmount = req.body.licensePeriod * plan.price_yearly;
  }

  const sellerReceivableBreakdown = result.data.purchase_units[0].payments.captures[0].seller_receivable_breakdown;

  if (result.data.status === 'COMPLETED' && sellerReceivableBreakdown.gross_amount.currency_code === 'USD' &&
    parseInt(sellerReceivableBreakdown.gross_amount.value) === totalAmount) {

    const user = req.user;
    const licenseKey = await LicenseController.generateLicense(user.email, req.body.licensePeriod);
    const paymentStatus = 'Purchased';
    user.paymentStatus = paymentStatus;
    user.planId = req.body.selectedPlanId;
    user.paymentIntent = result.data;
    user.licenseKey = licenseKey;
    user.licensePeriod = req.body.licensePeriod;

    let date = new Date();
    date.setUTCMonth(date.getUTCMonth() + req.body.licensePeriod);
    user.licenseExpireAt = date;

    await user.save();
    SocketServer.getInstance().sendMsg2Client(user.accessToken, 'payment', { paymentStatus, licenseKey });

    addNewNotification(user, 'You purchased successfully.');
  }
}

async function getNewAccessToken(baseURL) {
  const response = await axios({
    method: 'POST',
    url: `${baseURL}/v1/oauth2/token`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Access-Control-Allow-Credentials': true
    },
    data: qs.stringify({
      grant_type: 'client_credentials'
    }),
    auth: {
      username: process.env.PAYPAL_CLIENT_ID,
      password: process.env.PAYPAL_SECRET
    }
  });

  // An error happened when asking for a new token
  if (!response.data) {
    return 'fail';
  } else {
    return response.data.access_token;
  }
}

function getPaymentIntent(req, res, instance) {
  instance.defaults.headers.common = { 'Authorization': `bearer ${paypalAccessToken}` };

  const method = req.body.paymentIntent.links[0].method;
  if (method === 'GET') {
    instance.get(req.body.paymentIntent.links[0].href);
  } else {
    instance.post(req.body.paymentIntent.links[0].href);
  }
}

exports.getCoinList = async (req, res) => {
  const response = await client.rates({
    short: 1, accepted: 2
  });

  let coinList = [];
  for (let name in response) {
    const coin = { name, image: response[name].image };
    coinList.push(coin);
  }

  res.json({ success: true, coinList });
};

exports.createTransaction = async (req, res) => {

  const plan = await Plan.findOne({ _id: req.body.planId });

  if (plan === null) {
    res.json({ success: false });
  }

  let amount = plan.price_monthly;
  if (req.body.licensePeriod === 12) {
    amount = plan.price_yearly * 12;
  }

  const result = await client.createTransaction({
    currency1: 'USD',
    currency2: req.body.coinName,
    amount: amount,
    address: '',
    buyer_name: req.user.name,
    buyer_email: req.user.email,
    invoice: '',
    custom: '',
    item_name: plan.name,
    item_number: '1',
    success_url: '/',
    cancel_url: '/',
    ipn_url: 'https://www.tg-investment.com/price/coinpayments/webhook'
  });

  req.user.paymentIntent = result;
  req.user.planId = req.body.planId;
  req.user.paymentStatus = 'Ordered';
  await req.user.save();

  res.json({ success: true, result });
};

exports.coinpaymentsWebhook = async (req, res) => {
  try {
    if (!req.headers['hmac']) {
      console.log('IPN Error: No HMAC signature sent.');
      return res.status(400).send('IPN Error: No HMAC signature sent.');
    }

    if (!req.body.ipn_mode || req.body.ipn_mode !== 'hmac') {
      console.log('IPN Error: IPN Mode is not HMAC');
      return res.status(400).send('IPN Error: IPN Mode is not HMAC');
    }

    const hmac = crypto
      .createHmac('sha512', process.env.CP_IPN_SECRET)
      .update(new URLSearchParams(req.body).toString())
      .digest('hex');

    if (hmac !== req.headers['hmac']) {
      console.log('IPN Error: HMAC signature does not match');
      return res.status(400).send('IPN Error: HMAC signature does not match');
    }

    // HMAC Signature verified at this point, load some variables.
    const txn_id = req.body.txn_id;
    const amount1 = parseFloat(req.body.amount1);
    const currency1 = req.body.currency1;
    const status = parseInt(req.body.status, 10);

    // Check amount against order total
    let user = await User.findOne({ 'paymentIntent.txn_id': txn_id });

    if (user === null) {
      console.log('User null');
      console.log('txn_id: ' + txn_id);
      return res.send('No such user');
    }

    // Check the original currency to make sure the buyer didn't change it.
    if (currency1 !== 'USD') {
      console.log('IPN Error: Original currency mismatch!');
      return res.status(400).send('IPN Error: Original currency mismatch!');
    }

    if (user.paymentStatus === 'Purchased') {
      console.log('Purchased');
      return res.send('IPN OK');
    }

    const plan = await Plan.findOne({ '_id': user.planId });

    if (!plan) {
      console.log('No Plan');
      return res.status(400).send('No plan');
    }

    let totalAmount = 0;
    if (user.licensePeriod === 1) {
      totalAmount = user.licensePeriod * plan.price_monthly;
    } else {
      totalAmount = user.licensePeriod * plan.price_yearly;
    }

    if (amount1 < totalAmount) {
      console.log('Amount is less than order total!');
      return res.status(400).send('Amount is less than order total!');
    }

    if (status >= 100 || status === 2) {
      // payment is complete or queued for nightly payout, success

      const licenseKey = await LicenseController.generateLicense(user.email, user.licensePeriod);
      const paymentStatus = 'Purchased';
      user.paymentStatus = paymentStatus;
      user.licenseKey = licenseKey;

      let date = new Date();
      date.setUTCMonth(date.getUTCMonth() + user.licensePeriod);
      user.licenseExpireAt = date;

      await user.save();

      SocketServer.getInstance().sendMsg2Client(user.accessToken, 'payment', { paymentStatus, licenseKey });

      addNewNotification(user, 'Your purchased successfully.');

      res.send('IPN OK');

      console.log('license key: ' + licenseKey);
      console.log('Payment successful');
    } else if (status < 0) {
      // payment error, this is usually final but payments will sometimes be reopened if there was no exchange rate conversion or with seller consent
      console.log('Payment error');

      const paymentStatus = 'Not';
      user.paymentStatus = paymentStatus;
      user.licenseKey = '';
      user.licenseExpireAt = null;

      await user.save();

      SocketServer.getInstance().sendMsg2Client(user.accessToken, 'payment', { paymentStatus, licenseKey: '' });

      res.status(400).send('Payment error');
    } else {
      // payment is pending, you can optionally add a note to the order page
      console.log('Payment pending');
      res.send('IPN OK');
    }
  } catch (err) {
    console.error(err);

    try {
      res.status(400).send('IPN Error: Error processing IPN.');
    } catch (e) {
    }
  }
};
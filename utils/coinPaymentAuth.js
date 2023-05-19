const Coinpayments = require('coinpayments');

module.exports.client = new Coinpayments({
  key: process.env.CP_KEY,
  secret: process.env.CP_SECRET
});
const keys = require('../config/keys');
const jwt = require('jsonwebtoken');

const jwtService = (payload) => {
  return jwt.sign(payload, keys.secretOrKey, {
    expiresIn: '5 days'
  });
};

module.exports = jwtService;

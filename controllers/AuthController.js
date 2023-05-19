const User = require('../models/User');
const VisitCount = require('../models/VisitCount');
const RegisterCount = require('../models/RegisterCount');
const UserOtp = require('../models/UserOtp');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const keys = require('../config/keys');
const mailerService = require('../service/mailerService');
const jwtService = require('../service/jwtService');
const { getToday } = require('../utils/freqUtils');

exports.register = async (req, res) => {
  const { firstName, lastName, email, password, birthday, country } = req.body;

  const isUserExist = await User.findOne({ email });

  if (isUserExist) {
    return res.status(400).json({ error: 'Email already exists' });
  }

  const newUser = new User({
    name: `${firstName} ${lastName}`,
    email,
    password,
    birthday,
    country
  });

  const user = await newUser.save();

  // Sending OTP
  const otp = Math.floor(100000 + Math.random() * 900000);
  const existedOtp = await UserOtp.findOne({ email });
  if (existedOtp) {
    await UserOtp.deleteMany({ email });
  }

  await new UserOtp({ otp, userId: user.id, email }).save();

  mailerService({
    to: email,
    from: 'noreply@tg.com',
    subject: 'Verification Mail from TG ✅',
    template: `<p>Dear ${user.name},</p>
      <p>Thank you for registering with our website. Please verify your email address by clicking on the button below:</p>
      <p>Your OTP is <b>${otp}</b></p>
      <p>If you did not sign up for our website, please disregard this email.</p>
      <p>Thank you,</p>
      <p>The Website Team</p>`
  })
    .then(() => {
    })
    .catch((err) => console.log(err));

  return res.json({
    success: true,
    user
  });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  let user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({ error: 'Email not found' });
  }

  const isValidPassword = await user.validatePassword(password);

  if (!isValidPassword)
    return res.status(400).json({
      error: 'Password incorrect'
    });

  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    country: user.country,
    birthday: user.birthday,
    isVerified: user.isVerified,
    verifiedAt: user.emailVerifiedAt,
    role: user.role
  };

  const accessToken = jwtService(payload);

  user.accessToken = accessToken;
  await user.save();

  await increaseVisitCount();

  return res.json({
    success: true,
    accessToken,
    user
  });
};

exports.changePassword = async (req, res) => {
  let { oldPassword, newPassword } = req.body;

  const isValidPassword = await req.user.validatePassword(oldPassword);

  if (!isValidPassword)
    return res.json({
      success: false,
      msg: 'Old password is wrong.'
    });

  req.user.password = newPassword;
  await req.user.save();

  return res.json({
    success: true
  });
};

exports.checkPassword = async (req, res) => {
  const isValidPassword = await req.user.validatePassword(req.body.password);

  if (isValidPassword)
    return res.json({
      success: true
    });
  else
    return res.json({
      success: false
    });
};

exports.checkToken = async (req, res) => {
  const { email, accessToken } = req.body;

  let user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({ error: 'Email not found' });
  }

  if (!user.licenseKey) {
    return res.status(400).json({ error: 'Didn\'t purchased.' });
  }

  const isValidToken = await user.validateToken(accessToken);
  return res.json({
    success: isValidToken,
    licenseKey: user.licenseKey
  });
};

exports.verifyEmail = async (req, res) => {
  const { code, email } = req.body;

  const userOtp = await UserOtp.findOne({ email });

  if (!userOtp) return res.status(400).json({ error: 'User OTP Doesn\'t Exist' });

  if (userOtp.otp != code) {
    return res.status(400).json({
      error: 'User OTP Doesn\'t Match'
    });
  }

  let user = await User.findOneAndUpdate({ email }, { $set: { isVerified: true, emailVerifiedAt: new Date() } });

  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    country: user.country,
    birthday: user.birthday,
    isVerified: user.isVerified,
    verifiedAt: user.emailVerifiedAt
  };

  const accessToken = jwtService(payload);

  user.accessToken = accessToken;
  await user.save();

  await increaseVisitCount();
  await increaseRegisterCount();

  return res.json({
    success: true,
    accessToken,
    user
  });
};

module.exports.isAuthorized = async function(req, res, next) {
  try {
    if (!req.headers.authorization) {
      return res.status(401).json({
        error: new Error('No token.')
      });
    }

    const accessToken = req.headers.authorization.split(' ')[1];
    const decodedToken = jwt.verify(accessToken, keys.secretOrKey);
    const email = decodedToken.email;

    const user = await User.findOne({ email });

    if (user !== null && accessToken === user.accessToken) {
      req.user = user;
      next();
    } else {
      res.status(401).json({
        error: new Error('Invalid token.')
      });
    }
  } catch (e) {
    console.log('error: ' + e);

    res.status(401).json({
      error: new Error('You need to sign in first.')
    });
  }
};

async function increaseVisitCount() {
  let todayDate = getToday();

  let totalVisitCount = await VisitCount.findOne({ 'date': 'total' });
  if (totalVisitCount !== null) {
    totalVisitCount.count++;
    totalVisitCount.save();
  } else {
    totalVisitCount = new VisitCount({ 'date': 'total' });
    await totalVisitCount.save();
  }

  let todayVisitCount = await VisitCount.findOne({ 'date': todayDate });
  if (todayVisitCount !== null) {
    todayVisitCount.count++;
    todayVisitCount.save();
  } else {
    todayVisitCount = new VisitCount({ 'date': todayDate });
    await todayVisitCount.save();
  }
}

async function increaseRegisterCount() {
  let todayDate = getToday();

  let totalRegisterCount = await RegisterCount.findOne({ 'date': 'total' });
  if (totalRegisterCount !== null) {
    totalRegisterCount.count++;
    totalRegisterCount.save();
  } else {
    totalRegisterCount = new RegisterCount({ 'date': 'total' });
    await totalRegisterCount.save();
  }

  let todayRegisterCount = await RegisterCount.findOne({ 'date': todayDate });
  if (todayRegisterCount !== null) {
    todayRegisterCount.count++;
    todayRegisterCount.save();
  } else {
    todayRegisterCount = new RegisterCount({ 'date': todayDate });
    await todayRegisterCount.save();
  }
}
const VisitCount = require('../models/VisitCount');
const RegisterCount = require('../models/RegisterCount');
const { getToday, getSomeDayAgo } = require('../utils/freqUtils');
const LicenseController = require('./LicenseController');
const User = require('../models/User');

exports.getAccessCount = async (req, res) => {
  if (req.user.role === 'user') {
    return res.json({
      success: false,
      msg: 'You don\'t have right permission'
    });
  }

  let todayVisitCount = await VisitCount.getVisitCount(getToday());
  let totalVisitCount = await VisitCount.getTotalCount();
  let todayRegisterCount = await RegisterCount.getRegisterCount(getToday());
  let totalRegisterCount = await RegisterCount.getTotalCount();

  let graphDate = [];
  let graphVisitCount = [];
  let graphRegisterCount = [];
  for (let i = 0; i < 10; i++) {
    let date = getSomeDayAgo(i);
    let visitCount = await VisitCount.getVisitCount(date);
    let registerCount = await RegisterCount.getRegisterCount(date);

    graphDate.push(date);
    graphVisitCount.push(visitCount);
    graphRegisterCount.push(registerCount);
  }

  return res.json({
    success: true,
    todayVisitCount,
    totalVisitCount,
    todayRegisterCount,
    totalRegisterCount,
    graphDate,
    graphVisitCount,
    graphRegisterCount
  });
};

exports.giveLicenseKey = async (req, res) => {
  if (req.user.role !== 'super_admin') {
    return res.json({
      success: false,
      msg: 'You don\'t have right permission for this.'
    });
  }

  const email = req.body.email;

  const today = new Date();
  const expirationDate = new Date(req.body.expirationDate);

  const licensePeriod = (expirationDate.getFullYear() - today.getFullYear()) * 12 + (expirationDate.getMonth() - today.getMonth());

  let user = await User.findOne({ email });
  user.licenseExpireAt = expirationDate;
  user.paymentStatus = 'Purchased';
  user.licensePeriod = licensePeriod;
  user.licenseKey = await LicenseController.generateLicense(email, licensePeriod);

  try {
    await user.save();
    return res.json({
      success: true,
      licenseExpireAt: expirationDate,
      licensePeriod: licensePeriod,
      paymentStatus: 'Purchased'
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      msg: 'Something went wrong while saving the user.'
    });
  }
};
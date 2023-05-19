let jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.generateLicense = async (email, period = 1) => {
  try {
    let now = new Date();
    now.setMonth(now.getMonth() + period);
    let endDate = now.getTime();

    return await jwt.sign({ email: email }, endDate.toString());
  } catch (e) {
    return '';
  }
};

exports.checkLicenseValidation = async (req, res) => {
  const email = req.body.email;
  const licenseKey = req.body.licenseKey;

  try {
    User.findOne({ email: email }, (err, user) => {
      if (err) {
        res.json({ isValidLicenseKey: false });
      } else {
        if (!user) {
          res.json({ isValidLicenseKey: false });
        } else {
          if (user.licenseKey === licenseKey) {
            let today = Date.now();
            let expireDate = new Date(user.licenseExpireAt);
            let gap = expireDate.getTime() - today;
            if (gap <= 0)
              res.json({ isValidLicenseKey: false });
            else {
              const remains = parseInt(gap / (3600000 * 24));
              res.json({ isValidLicenseKey: true, remains: remains });
            }
          } else {
            res.json({ isValidLicenseKey: false });
          }
        }
      }
    });
  } catch (e) {
    if (typeof e === 'string') {
      res.json({ isValidLicenseKey: false });
    } else if (e instanceof Error) {
      res.json({ isValidLicenseKey: false });
    }
  }
};

exports.getLicenseInfo = async (req, res) => {

  const plan = await Plan.findOne({ _id: req.user.planId });

  if (!plan)
    return res.json({ licenseInfo: null });

  const activePlan = plan.name;
  const licenseInfo = {
    status: req.user.paymentStatus,
    expireAt: req.user.licenseExpireAt,
    activePlan,
    licenseKey: req.user.licenseKey
  };

  res.json({ licenseInfo });
};

exports.expireLicenseKey = async (req, res) => {

  let user = req.user;
  user.paymentStatus = 'Not';
  await user.save();

  const licenseInfo = {
    status: 'Not'
  };

  res.json({ success: true, licenseInfo });
};
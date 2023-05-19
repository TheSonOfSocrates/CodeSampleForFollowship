const User = require('../models/User');
const jwtService = require('../service/jwtService');
const mailerService = require('../service/mailerService');
const SocketServer = require('../socket');

exports.getAllUsers = async (req, res) => {
  const users = await User.find().populate('planId');
  return res.json({
    success: true,
    users
  });
};

exports.updateUser = async (req, res) => {
  let user = await User.findOne({ email: req.body.user.email });
  user.name = req.body.user.name;
  user.email = req.body.user.email;
  user.birthday = req.body.user.birthday;
  user.country = req.body.user.country;

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

  return res.json({
    success: true,
    accessToken
  });
};

exports.deleteUser = async (req, res) => {
  const { email } = req.body;
  await User.findOneAndDelete({ email });
  const users = await User.find();

  return res.json({
    success: true,
    users
  });
};

exports.sendEmail = async (req, res) => {
  const { name, email, subject, message } = req.body;
  console.log(name, email);
  mailerService({
    to: 'tgblockchaininvest@gmail.com',
    from: email,
    subject: subject,
    template: `<h3>New email from <${name}></h3>
    <p>${message}</p>`
  })
    .then(() => {
    })
    .catch((err) => console.log(err));

  return res.json({
    success: true
  });
};

exports.getNotifications = async (req, res) => {
  return res.json({
    notifications: req.user.notifications
  });
};

exports.deleteNotifications = async (req, res) => {
  req.user.notifications = req.user.notifications.filter(notification =>
    !req.body.idList.includes(notification._id.toString()));

  let user = await User.findOne({ email: req.user.email });
  user.notifications = req.user.notifications;
  await user.save();

  return res.json({ success: true });
};

exports.sendNotifications = async (req, res) => {
  try {
    for (const email of req.body.emailList) {
      const user = await User.findOne({ email });
      const sender = { name: req.user.name, avatar: req.user.avatar };
      user.notifications.push({ content: req.body.notiMsg, sender });
      await user.save();

      const notification = user.notifications[user.notifications.length - 1];

      if (user.accessToken !== null && user.accessToken !== undefined) {
        SocketServer.getInstance().sendMsg2Client(user.accessToken, 'notification', { notification });
      }
    }

    return res.json({ success: true });
  } catch (e) {
    return res.json({ success: false });
  }
};

exports.viewNotification = async (req, res) => {
  for (let i = 0; i < req.user.notifications.length; i++) {
    if (req.user.notifications[i]._id == req.body.id) {
      // req.user.notifications.splice(i, 1);
      req.user.notifications[i].status = 'Read';
      break;
    }
  }
  await req.user.save();
  return res.json({ success: true });
};

exports.viewAllNotification = async (req, res) => {
  for (let notification of req.user.notifications) {
    notification.status = 'Read';
  }
  await req.user.save();
  return res.json({ success: true });
};

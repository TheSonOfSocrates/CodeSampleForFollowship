const User = require('../models/User');
const SocketServer = require('../socket');

module.exports.getToday = function() {
  let dateObj = new Date();
  let month = dateObj.getUTCMonth() + 1;
  let day = dateObj.getUTCDate();
  let year = dateObj.getUTCFullYear();
  return year + '/' + month + '/' + day;
};

module.exports.getSomeDayAgo = function(ago) {
  let dateObj = new Date();
  dateObj.setDate(dateObj.getUTCDate() - ago);
  let month = dateObj.getUTCMonth() + 1;
  let day = dateObj.getUTCDate();
  let year = dateObj.getUTCFullYear();
  return year + '/' + month + '/' + day;
};

module.exports.getFormattedDateTime = function(dateTime) {
  const padL = (nr, len = 2, chr = `0`) => `${nr}`.padStart(2, chr);

  return `${
    padL(dateTime.getMonth() + 1)}/${
    padL(dateTime.getDate())}/${
    dateTime.getFullYear()} ${
    padL(dateTime.getHours())}:${
    padL(dateTime.getMinutes())}:${
    padL(dateTime.getSeconds())}`;
};

module.exports.addNewNotification = async function(user, content) {
  let sender = {};
  const adminUser = await User.searchAdminUser();
  if (adminUser != null) {
    sender = { name: adminUser.name, avatar: adminUser.avatar };
  }

  user.notifications.push({ content, sender });
  await user.save();

  SocketServer.getInstance().sendMsg2Client(user.accessToken, 'notification', { notification: user.notifications[user.notifications.length - 1] });
};
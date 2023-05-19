const nodemailer = require('nodemailer');

module.exports = async ({ to, from, subject, template, text }) => {
  // set your own mail server :)
  let transporter = nodemailer.createTransport({
    host: 'smtp.mailgun.org',
    port: 587,
    // secure: false,
    auth: {
      user: 'postmaster@tg-investment.com',
      pass: '2e368dda6a9b4981bb93141c06ace780-15b35dee-47f49d54'
    }
  });

  try {
    let info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: template
    });

    return {
      success: true,
      info
    };
  } catch (err) {
    console.log(err);
    return {
      success: false,
      error: err
    };
  }
};

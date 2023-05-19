const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const UserOtpSchema = new Schema(
  {
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Users'
    },
    email: {
      type: String
    },
    otp: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = User = mongoose.model('UserOtp', UserOtpSchema);

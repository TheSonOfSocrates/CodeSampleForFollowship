const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Schema = mongoose.Schema;

// Create Schema
const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    avatar: {
      type: String,
      required: true,
      default: 'default.jpg'
    },
    country: {
      type: String,
      required: true
    },
    birthday: {
      type: Date,
      default: null
    },
    role: {
      type: String,
      default: 'user'
    },
    password: {
      type: String,
      required: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    emailVerifiedAt: {
      type: Date,
      default: null
    },
    accessToken: {
      type: String
    },
    paymentStatus: {
      type: String,
      default: 'Not'
    },
    paymentIntent: {
      type: Object
    },
    planId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'plans'
    },
    licensePeriod: {
      type: Number
    },
    licenseKey: {
      type: String,
      default: ''
    },
    licenseExpireAt: {
      type: Date,
      default: null
    },
    notifications: [
      {
        content: {
          type: String,
          default: ''
        },
        status: {
          type: String,
          default: 'New',
          required: true
        },
        date: {
          type: Date,
          default: Date.now,
          required: true
        },
        sender: {
          name: {
            type: String
          },
          avatar: {
            type: String
          }
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(this.password, salt);
  this.password = hashedPassword;
});

UserSchema.methods.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

UserSchema.methods.validateToken = async function(accessToken) {
  return accessToken === this.accessToken;
};

UserSchema.statics.searchAdminUser = async function() {
  const adminUser = await this.findOne({ role: 'admin' });
  if (adminUser) {
    return adminUser;
  } else {
    return null;
  }
};

module.exports = User = mongoose.model('users', UserSchema);
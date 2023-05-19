const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const PlanSchema = new Schema(
  {
    name: {
      type: String,
      required: true
    },
    price_monthly: {
      type: Number,
      required: true
    },
    price_yearly: {
      type: Number,
      required: true
    },
    benefits: [
      {
        supported: Boolean,
        title: String,
        detail: String
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = Plan = mongoose.model('plans', PlanSchema);
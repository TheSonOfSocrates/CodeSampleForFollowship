const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { getToday, getSomeDayAgo } = require('../utils/freqUtils');
const Schema = mongoose.Schema;

// Create Schema
let VisitCountSchema = new Schema(
  {
    date: {
      type: String,
      required: true
    },
    count: {
      type: Number,
      required: true,
      default: 1
    }
  }
);

VisitCountSchema.statics.getVisitCount = async function(date) {
  let count = 0;
  let visitCount = await this.findOne({ date });
  if (visitCount !== null) {
    count = visitCount.count;
  }
  return count;
};

VisitCountSchema.statics.getTotalCount = async function() {
  return (await this.findOne({ 'date': 'total' })).count;
};

module.exports = VisitCountSchema = mongoose.model('visit_counts', VisitCountSchema);
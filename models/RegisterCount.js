const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
let RegisterCountSchema = new Schema(
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

RegisterCountSchema.statics.getRegisterCount = async function(date) {
  let count = 0;
  let registerCount = await this.findOne({ date });
  if (registerCount !== null) {
    count = registerCount.count;
  }
  return count;
};

RegisterCountSchema.statics.getTotalCount = async function() {
  return (await this.findOne({ 'date': 'total' })).count;
};

module.exports = RegisterCountSchema = mongoose.model('register_counts', RegisterCountSchema);
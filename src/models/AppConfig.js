const mongoose = require('mongoose');

const appConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Static method to get config value
appConfigSchema.statics.getValue = async function(key, defaultValue = null) {
  const config = await this.findOne({ key });
  return config ? config.value : defaultValue;
};

// Static method to set config value
appConfigSchema.statics.setValue = async function(key, value, description = '', userId = null) {
  return await this.findOneAndUpdate(
    { key },
    { value, description, updatedBy: userId },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('AppConfig', appConfigSchema);

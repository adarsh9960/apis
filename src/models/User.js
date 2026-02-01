const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Payment status
  setupFeePaid: {
    type: Boolean,
    default: false
  },
  setupFeeBypassedByAdmin: {
    type: Boolean,
    default: false
  },
  subscriptionActive: {
    type: Boolean,
    default: false
  },
  subscriptionExpiresAt: {
    type: Date,
    default: null
  },
  // AI Configuration
  aiProvider: {
    type: String,
    enum: ['openai', 'gemini', 'claude', 'glm', 'other'],
    default: null
  },
  aiApiKey: {
    type: String,
    default: null
  },
  // Reply settings
  replyMode: {
    type: String,
    enum: ['ai', 'template', 'manual'],
    default: 'manual'
  },
  // Google Business Profile
  googleAccessToken: {
    type: String,
    default: null
  },
  googleRefreshToken: {
    type: String,
    default: null
  },
  googleTokenExpiresAt: {
    type: Date,
    default: null
  },
  connectedBusinessAccounts: [{
    accountId: String,
    accountName: String,
    locations: [{
      locationId: String,
      locationName: String,
      address: String
    }]
  }],
  // Created by admin tracking
  createdByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if user needs to pay setup fee
userSchema.methods.needsSetupFee = function() {
  if (this.role === 'admin') return false;
  if (this.setupFeePaid) return false;
  if (this.setupFeeBypassedByAdmin) return false;
  return true;
};

// Check if user has active access
userSchema.methods.hasActiveAccess = function() {
  if (this.role === 'admin') return true;
  if (!this.setupFeePaid && !this.setupFeeBypassedByAdmin) return false;
  if (!this.subscriptionActive) return false;
  if (this.subscriptionExpiresAt && new Date() > this.subscriptionExpiresAt) return false;
  return true;
};

module.exports = mongoose.model('User', userSchema);

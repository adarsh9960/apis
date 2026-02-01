const mongoose = require('mongoose');

const replyTemplateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['positive', 'negative', 'neutral', 'custom'],
    default: 'custom'
  },
  // Star rating trigger (1-5, or null for any)
  starRating: {
    min: { type: Number, min: 1, max: 5, default: 1 },
    max: { type: Number, min: 1, max: 5, default: 5 }
  },
  // Template content with placeholders
  // Available placeholders: {{reviewer_name}}, {{business_name}}, {{rating}}
  content: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for faster queries
replyTemplateSchema.index({ user: 1, category: 1, isActive: 1 });

module.exports = mongoose.model('ReplyTemplate', replyTemplateSchema);

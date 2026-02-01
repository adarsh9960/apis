const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Google Business Profile identifiers
  googleReviewId: {
    type: String,
    required: true,
    unique: true
  },
  locationId: {
    type: String,
    required: true
  },
  locationName: {
    type: String
  },
  // Review details
  reviewerName: {
    type: String,
    default: 'Anonymous'
  },
  reviewerPhotoUrl: {
    type: String,
    default: null
  },
  starRating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  comment: {
    type: String,
    default: ''
  },
  reviewCreatedAt: {
    type: Date,
    required: true
  },
  // Reply details
  replyStatus: {
    type: String,
    enum: ['pending', 'replied', 'failed', 'skipped'],
    default: 'pending'
  },
  replyMethod: {
    type: String,
    enum: ['ai', 'template', 'manual'],
    default: null
  },
  replyContent: {
    type: String,
    default: null
  },
  repliedAt: {
    type: Date,
    default: null
  },
  replyError: {
    type: String,
    default: null
  },
  // Template used (if template method)
  templateUsed: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReplyTemplate',
    default: null
  },
  // AI provider used (if AI method)
  aiProviderUsed: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes (googleReviewId already has unique:true above)
reviewSchema.index({ user: 1, replyStatus: 1 });
reviewSchema.index({ locationId: 1 });

module.exports = mongoose.model('Review', reviewSchema);

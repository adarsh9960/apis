const Review = require('../models/Review');

// @desc    Get user's reviews
// @route   GET /api/reviews
// @access  Private
const getReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const locationId = req.query.locationId;

    const filter = { user: req.user._id };
    if (status) filter.replyStatus = status;
    if (locationId) filter.locationId = locationId;

    const reviews = await Review.find(filter)
      .sort({ reviewCreatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments(filter);

    res.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get review by ID
// @route   GET /api/reviews/:id
// @access  Private
const getReviewById = async (req, res) => {
  try {
    const review = await Review.findOne({ _id: req.params.id, user: req.user._id });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    res.json(review);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get review stats
// @route   GET /api/reviews/stats
// @access  Private
const getReviewStats = async (req, res) => {
  try {
    const stats = await Review.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$replyStatus', 'pending'] }, 1, 0] } },
          replied: { $sum: { $cond: [{ $eq: ['$replyStatus', 'replied'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$replyStatus', 'failed'] }, 1, 0] } },
          avgRating: { $avg: '$starRating' },
          fiveStars: { $sum: { $cond: [{ $eq: ['$starRating', 5] }, 1, 0] } },
          fourStars: { $sum: { $cond: [{ $eq: ['$starRating', 4] }, 1, 0] } },
          threeStars: { $sum: { $cond: [{ $eq: ['$starRating', 3] }, 1, 0] } },
          twoStars: { $sum: { $cond: [{ $eq: ['$starRating', 2] }, 1, 0] } },
          oneStar: { $sum: { $cond: [{ $eq: ['$starRating', 1] }, 1, 0] } }
        }
      }
    ]);

    res.json(stats[0] || {
      totalReviews: 0,
      pending: 0,
      replied: 0,
      failed: 0,
      avgRating: 0,
      fiveStars: 0,
      fourStars: 0,
      threeStars: 0,
      twoStars: 0,
      oneStar: 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update review reply status (after manual reply)
// @route   PUT /api/reviews/:id/status
// @access  Private
const updateReviewStatus = async (req, res) => {
  try {
    const { status, replyContent, replyMethod } = req.body;

    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      {
        replyStatus: status,
        replyContent,
        replyMethod,
        repliedAt: status === 'replied' ? new Date() : null
      },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json(review);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getReviews,
  getReviewById,
  getReviewStats,
  updateReviewStatus
};

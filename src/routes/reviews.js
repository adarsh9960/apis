const express = require('express');
const router = express.Router();
const {
  getReviews,
  getReviewById,
  getReviewStats,
  updateReviewStatus
} = require('../controllers/reviewController');
const { protect, requireActiveSubscription } = require('../middleware/auth');

router.use(protect, requireActiveSubscription);

router.get('/', getReviews);
router.get('/stats', getReviewStats);
router.get('/:id', getReviewById);
router.put('/:id/status', updateReviewStatus);

module.exports = router;

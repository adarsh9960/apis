const express = require('express');
const router = express.Router();
const {
  getAuthUrl,
  handleCallback,
  getAccounts,
  getLocations,
  getReviews,
  replyToReview,
  disconnect
} = require('../controllers/googleController');
const { protect, requireActiveSubscription } = require('../middleware/auth');

// OAuth callback (public)
router.get('/callback', handleCallback);

// Protected routes
router.use(protect);

router.get('/auth-url', getAuthUrl);
router.delete('/disconnect', disconnect);

// Routes requiring active subscription
router.use(requireActiveSubscription);

router.get('/accounts', getAccounts);
router.get('/accounts/:accountId/locations', getLocations);
router.get('/locations/:locationId/reviews', getReviews);
router.post('/reviews/:reviewId/reply', replyToReview);

module.exports = router;

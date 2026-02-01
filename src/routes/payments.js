const express = require('express');
const router = express.Router();
const {
  createSetupFeeOrder,
  verifySetupFeePayment,
  getSubscriptionUrl,
  handleWebhook,
  getPaymentHistory
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

router.post('/webhook', handleWebhook); // Public endpoint for Razorpay webhooks

router.use(protect); // All other routes require auth

router.post('/setup-fee/create', createSetupFeeOrder);
router.post('/setup-fee/verify', verifySetupFeePayment);
router.get('/subscription-url', getSubscriptionUrl);
router.get('/history', getPaymentHistory);

module.exports = router;

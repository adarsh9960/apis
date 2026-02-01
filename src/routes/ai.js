const express = require('express');
const router = express.Router();
const {
  generateReply,
  testAIConfig,
  getProviders
} = require('../controllers/aiController');
const { protect, requireActiveSubscription } = require('../middleware/auth');

router.get('/providers', getProviders); // Public

router.use(protect);

router.post('/test', testAIConfig);

router.use(requireActiveSubscription);

router.post('/generate-reply', generateReply);

module.exports = router;

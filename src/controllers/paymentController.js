const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/User');
const Payment = require('../models/Payment');
const AppConfig = require('../models/AppConfig');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// @desc    Create order for setup fee
// @route   POST /api/payments/setup-fee/create
// @access  Private
const createSetupFeeOrder = async (req, res) => {
  try {
    // Check if user already paid
    if (req.user.setupFeePaid || req.user.setupFeeBypassedByAdmin) {
      return res.status(400).json({ message: 'Setup fee already paid or waived' });
    }

    // Get setup fee from config or env
    const setupFee = await AppConfig.getValue('setupFee', parseInt(process.env.SETUP_FEE) || 99);

    // Receipt must be max 40 chars
    const shortId = req.user._id.toString().slice(-8);
    const timestamp = Date.now().toString().slice(-8);
    
    const options = {
      amount: setupFee * 100, // Razorpay expects amount in paise
      currency: 'INR',
      receipt: `setup_${shortId}_${timestamp}`,
      notes: {
        userId: req.user._id.toString(),
        type: 'setup_fee'
      }
    };

    const order = await razorpay.orders.create(options);

    // Create payment record
    await Payment.create({
      user: req.user._id,
      type: 'setup_fee',
      amount: setupFee,
      razorpayOrderId: order.id,
      status: 'pending'
    });

    res.json({
      orderId: order.id,
      amount: setupFee,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Verify setup fee payment
// @route   POST /api/payments/setup-fee/verify
// @access  Private
const verifySetupFeePayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    // Update payment record
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'completed'
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found' });
    }

    // Update user
    await User.findByIdAndUpdate(req.user._id, { setupFeePaid: true });

    res.json({
      message: 'Payment verified successfully',
      setupFeePaid: true
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get subscription URL
// @route   GET /api/payments/subscription-url
// @access  Private
const getSubscriptionUrl = async (req, res) => {
  try {
    const url = await AppConfig.getValue('monthlySubscriptionUrl', process.env.MONTHLY_SUBSCRIPTION_URL);
    res.json({ url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Webhook for subscription payments (from external payment link)
// @route   POST /api/payments/webhook
// @access  Public (verified by signature)
const handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    // Verify webhook signature if secret is set
    if (webhookSecret) {
      const signature = req.headers['x-razorpay-signature'];
      const body = JSON.stringify(req.body);
      
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      if (signature !== expectedSignature) {
        return res.status(400).json({ message: 'Invalid webhook signature' });
      }
    }

    const event = req.body;

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const email = payment.email || payment.notes?.email;

      if (email) {
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (user) {
          // Extend subscription by 30 days
          const currentExpiry = user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > new Date()
            ? new Date(user.subscriptionExpiresAt)
            : new Date();
          
          const newExpiry = new Date(currentExpiry);
          newExpiry.setDate(newExpiry.getDate() + 30);

          await User.findByIdAndUpdate(user._id, {
            subscriptionActive: true,
            subscriptionExpiresAt: newExpiry
          });

          // Record payment
          await Payment.create({
            user: user._id,
            type: 'subscription',
            amount: payment.amount / 100,
            razorpayPaymentId: payment.id,
            status: 'completed',
            subscriptionPeriodStart: currentExpiry,
            subscriptionPeriodEnd: newExpiry
          });
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Webhook error', error: error.message });
  }
};

// @desc    Get payment history
// @route   GET /api/payments/history
// @access  Private
const getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createSetupFeeOrder,
  verifySetupFeePayment,
  getSubscriptionUrl,
  handleWebhook,
  getPaymentHistory
};

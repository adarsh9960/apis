const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      if (!req.user.isActive) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Admin only middleware
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
};

// Check if user has paid setup fee and has active subscription
const requireActiveSubscription = async (req, res, next) => {
  if (req.user.role === 'admin') {
    return next();
  }

  if (req.user.needsSetupFee()) {
    return res.status(402).json({ 
      message: 'Setup fee required',
      needsSetupFee: true,
      setupFee: parseInt(process.env.SETUP_FEE) || 99
    });
  }

  if (!req.user.hasActiveAccess()) {
    return res.status(402).json({ 
      message: 'Active subscription required',
      needsSubscription: true,
      subscriptionUrl: process.env.MONTHLY_SUBSCRIPTION_URL
    });
  }

  next();
};

module.exports = { protect, adminOnly, requireActiveSubscription };

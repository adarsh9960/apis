const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppConfig = require('../models/AppConfig');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Check if this is the admin email
    const isAdmin = email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: isAdmin ? 'admin' : 'user',
      setupFeePaid: isAdmin,
      subscriptionActive: isAdmin
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
        needsSetupFee: user.needsSetupFee(),
        hasActiveAccess: user.hasActiveAccess()
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
        needsSetupFee: user.needsSetupFee(),
        hasActiveAccess: user.hasActiveAccess(),
        aiProvider: user.aiProvider,
        replyMode: user.replyMode,
        subscriptionActive: user.subscriptionActive,
        subscriptionExpiresAt: user.subscriptionExpiresAt
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -aiApiKey');
    
    res.json({
      ...user.toObject(),
      needsSetupFee: user.needsSetupFee(),
      hasActiveAccess: user.hasActiveAccess()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/me
// @access  Private
const updateMe = async (req, res) => {
  try {
    const { name, aiProvider, aiApiKey, replyMode } = req.body;

    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (aiProvider) user.aiProvider = aiProvider;
    if (aiApiKey) user.aiApiKey = aiApiKey;
    if (replyMode) user.replyMode = replyMode;

    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      aiProvider: user.aiProvider,
      replyMode: user.replyMode,
      needsSetupFee: user.needsSetupFee(),
      hasActiveAccess: user.hasActiveAccess()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { register, login, getMe, updateMe };

const User = require('../models/User');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const AppConfig = require('../models/AppConfig');

// @desc    Get all users (admin only)
// @route   GET /api/admin/users
// @access  Admin
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find({ role: 'user' })
      .select('-password -aiApiKey -googleAccessToken -googleRefreshToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments({ role: 'user' });

    res.json({
      users,
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

// @desc    Get user details (admin only)
// @route   GET /api/admin/users/:id
// @access  Admin
const getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -aiApiKey -googleAccessToken -googleRefreshToken');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's payment history
    const payments = await Payment.find({ user: user._id }).sort({ createdAt: -1 }).limit(10);

    // Get user's review stats
    const reviewStats = await Review.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          replied: { $sum: { $cond: [{ $eq: ['$replyStatus', 'replied'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$replyStatus', 'pending'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$replyStatus', 'failed'] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      user,
      payments,
      reviewStats: reviewStats[0] || { totalReviews: 0, replied: 0, pending: 0, failed: 0 }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create user (admin only - bypasses setup fee)
// @route   POST /api/admin/users
// @access  Admin
const createUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user with setup fee bypassed
    const user = await User.create({
      name,
      email,
      password,
      role: 'user',
      setupFeeBypassedByAdmin: true,
      createdByAdmin: req.user._id
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      setupFeeBypassedByAdmin: true,
      message: 'User created successfully. Setup fee has been waived.'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update user (admin only)
// @route   PUT /api/admin/users/:id
// @access  Admin
const updateUser = async (req, res) => {
  try {
    const { name, isActive, subscriptionActive, subscriptionExpiresAt, setupFeePaid, setupFeeBypassedByAdmin } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name !== undefined) user.name = name;
    if (isActive !== undefined) user.isActive = isActive;
    if (subscriptionActive !== undefined) user.subscriptionActive = subscriptionActive;
    if (subscriptionExpiresAt !== undefined) user.subscriptionExpiresAt = subscriptionExpiresAt;
    if (setupFeePaid !== undefined) user.setupFeePaid = setupFeePaid;
    if (setupFeeBypassedByAdmin !== undefined) user.setupFeeBypassedByAdmin = setupFeeBypassedByAdmin;

    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      subscriptionActive: user.subscriptionActive,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      setupFeePaid: user.setupFeePaid,
      setupFeeBypassedByAdmin: user.setupFeeBypassedByAdmin,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete user (admin only)
// @route   DELETE /api/admin/users/:id
// @access  Admin
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot delete admin user' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get dashboard stats (admin only)
// @route   GET /api/admin/stats
// @access  Admin
const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const activeUsers = await User.countDocuments({ role: 'user', isActive: true, subscriptionActive: true });
    const totalPayments = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalReviews = await Review.countDocuments();
    const repliedReviews = await Review.countDocuments({ replyStatus: 'replied' });

    // Recent signups (last 7 days)
    const recentSignups = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    // Payment stats (last 30 days)
    const recentPayments = await Payment.aggregate([
      { 
        $match: { 
          status: 'completed',
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    res.json({
      totalUsers,
      activeUsers,
      totalRevenue: totalPayments[0]?.total || 0,
      totalReviews,
      repliedReviews,
      replyRate: totalReviews > 0 ? ((repliedReviews / totalReviews) * 100).toFixed(1) : 0,
      recentSignups,
      recentRevenue: recentPayments[0]?.total || 0,
      recentPaymentCount: recentPayments[0]?.count || 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get/Set app config (admin only)
// @route   GET/PUT /api/admin/config
// @access  Admin
const getAppConfig = async (req, res) => {
  try {
    const configs = await AppConfig.find();
    const configObj = {};
    configs.forEach(c => { configObj[c.key] = c.value; });

    // Include defaults
    res.json({
      setupFee: configObj.setupFee || parseInt(process.env.SETUP_FEE) || 99,
      monthlySubscriptionUrl: configObj.monthlySubscriptionUrl || process.env.MONTHLY_SUBSCRIPTION_URL,
      ...configObj
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateAppConfig = async (req, res) => {
  try {
    const updates = req.body;

    for (const [key, value] of Object.entries(updates)) {
      await AppConfig.setValue(key, value, '', req.user._id);
    }

    res.json({ message: 'Configuration updated successfully', updates });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAllUsers,
  getUserDetails,
  createUser,
  updateUser,
  deleteUser,
  getDashboardStats,
  getAppConfig,
  updateAppConfig
};

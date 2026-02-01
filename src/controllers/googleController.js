const { google } = require('googleapis');
const User = require('../models/User');
const Review = require('../models/Review');

// OAuth2 client setup
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

// @desc    Get Google OAuth URL
// @route   GET /api/google/auth-url
// @access  Private
const getAuthUrl = async (req, res) => {
  try {
    const oauth2Client = getOAuth2Client();

    const scopes = [
      'https://www.googleapis.com/auth/business.manage'
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: req.user._id.toString(),
      prompt: 'consent'
    });

    res.json({ url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Handle Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
const handleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = state;

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Save tokens to user
    await User.findByIdAndUpdate(userId, {
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token,
      googleTokenExpiresAt: new Date(tokens.expiry_date)
    });

    // Redirect to app with success
    res.redirect('/google-connected?success=true');
  } catch (error) {
    console.error(error);
    res.redirect('/google-connected?error=' + encodeURIComponent(error.message));
  }
};

// @desc    Get connected business accounts
// @route   GET /api/google/accounts
// @access  Private
const getAccounts = async (req, res) => {
  try {
    if (!req.user.googleAccessToken) {
      return res.status(400).json({ message: 'Google Business Profile not connected' });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: req.user.googleAccessToken,
      refresh_token: req.user.googleRefreshToken
    });

    const mybusiness = google.mybusinessaccountmanagement({ version: 'v1', auth: oauth2Client });
    
    const response = await mybusiness.accounts.list();
    const accounts = response.data.accounts || [];

    // Update user's connected accounts
    const formattedAccounts = accounts.map(acc => ({
      accountId: acc.name,
      accountName: acc.accountName,
      locations: []
    }));

    await User.findByIdAndUpdate(req.user._id, {
      connectedBusinessAccounts: formattedAccounts
    });

    res.json(accounts);
  } catch (error) {
    console.error(error);
    
    // Handle token expiry
    if (error.code === 401) {
      return res.status(401).json({ message: 'Google token expired. Please reconnect.' });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get locations for an account
// @route   GET /api/google/accounts/:accountId/locations
// @access  Private
const getLocations = async (req, res) => {
  try {
    if (!req.user.googleAccessToken) {
      return res.status(400).json({ message: 'Google Business Profile not connected' });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: req.user.googleAccessToken,
      refresh_token: req.user.googleRefreshToken
    });

    const mybusiness = google.mybusinessbusinessinformation({ version: 'v1', auth: oauth2Client });
    
    const accountId = req.params.accountId;
    const response = await mybusiness.accounts.locations.list({
      parent: accountId,
      readMask: 'name,title,storefrontAddress'
    });

    res.json(response.data.locations || []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get reviews for a location
// @route   GET /api/google/locations/:locationId/reviews
// @access  Private
const getReviews = async (req, res) => {
  try {
    if (!req.user.googleAccessToken) {
      return res.status(400).json({ message: 'Google Business Profile not connected' });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: req.user.googleAccessToken,
      refresh_token: req.user.googleRefreshToken
    });

    const mybusiness = google.mybusiness({ version: 'v4', auth: oauth2Client });
    
    const locationId = req.params.locationId;
    const response = await mybusiness.accounts.locations.reviews.list({
      parent: locationId,
      pageSize: 50
    });

    const reviews = response.data.reviews || [];

    // Sync reviews to database
    for (const review of reviews) {
      await Review.findOneAndUpdate(
        { googleReviewId: review.name },
        {
          user: req.user._id,
          googleReviewId: review.name,
          locationId: locationId,
          reviewerName: review.reviewer?.displayName || 'Anonymous',
          reviewerPhotoUrl: review.reviewer?.profilePhotoUrl,
          starRating: parseInt(review.starRating?.replace('STAR_RATING_', '').replace('_', '')) || parseInt(review.starRating) || 5,
          comment: review.comment || '',
          reviewCreatedAt: new Date(review.createTime),
          replyStatus: review.reviewReply ? 'replied' : 'pending',
          replyContent: review.reviewReply?.comment || null,
          repliedAt: review.reviewReply ? new Date(review.reviewReply.updateTime) : null
        },
        { upsert: true, new: true }
      );
    }

    res.json(reviews);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Reply to a review
// @route   POST /api/google/reviews/:reviewId/reply
// @access  Private
const replyToReview = async (req, res) => {
  try {
    const { comment } = req.body;
    const reviewId = req.params.reviewId;

    if (!req.user.googleAccessToken) {
      return res.status(400).json({ message: 'Google Business Profile not connected' });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: req.user.googleAccessToken,
      refresh_token: req.user.googleRefreshToken
    });

    const mybusiness = google.mybusiness({ version: 'v4', auth: oauth2Client });

    await mybusiness.accounts.locations.reviews.updateReply({
      name: reviewId + '/reply',
      requestBody: {
        comment: comment
      }
    });

    // Update local review record
    await Review.findOneAndUpdate(
      { googleReviewId: reviewId },
      {
        replyStatus: 'replied',
        replyContent: comment,
        repliedAt: new Date(),
        replyMethod: 'manual'
      }
    );

    res.json({ message: 'Reply posted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Disconnect Google account
// @route   DELETE /api/google/disconnect
// @access  Private
const disconnect = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiresAt: null,
      connectedBusinessAccounts: []
    });

    res.json({ message: 'Google account disconnected' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAuthUrl,
  handleCallback,
  getAccounts,
  getLocations,
  getReviews,
  replyToReview,
  disconnect
};

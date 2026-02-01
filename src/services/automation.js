const cron = require('node-cron');
const User = require('../models/User');
const Review = require('../models/Review');
const { google } = require('googleapis');
const { generateAIReply, generateTemplateReply } = require('../controllers/aiController');

// Get OAuth2 client for a user
const getOAuth2Client = (user) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken
  });
  
  return oauth2Client;
};

// Fetch new reviews for a user
const fetchNewReviews = async (user) => {
  if (!user.googleAccessToken) return [];
  
  try {
    const oauth2Client = getOAuth2Client(user);
    const mybusiness = google.mybusiness({ version: 'v4', auth: oauth2Client });
    
    const newReviews = [];
    
    for (const account of user.connectedBusinessAccounts || []) {
      for (const location of account.locations || []) {
        try {
          const response = await mybusiness.accounts.locations.reviews.list({
            parent: location.locationId,
            pageSize: 20
          });
          
          const reviews = response.data.reviews || [];
          
          for (const review of reviews) {
            // Check if review already exists
            const exists = await Review.findOne({ googleReviewId: review.name });
            
            if (!exists && !review.reviewReply) {
              // New unreplied review
              const newReview = await Review.create({
                user: user._id,
                googleReviewId: review.name,
                locationId: location.locationId,
                locationName: location.locationName,
                reviewerName: review.reviewer?.displayName || 'Anonymous',
                reviewerPhotoUrl: review.reviewer?.profilePhotoUrl,
                starRating: parseInt(review.starRating) || 5,
                comment: review.comment || '',
                reviewCreatedAt: new Date(review.createTime),
                replyStatus: 'pending'
              });
              
              newReviews.push(newReview);
            }
          }
        } catch (error) {
          console.error(`Error fetching reviews for location ${location.locationId}:`, error.message);
        }
      }
    }
    
    return newReviews;
  } catch (error) {
    console.error(`Error fetching reviews for user ${user._id}:`, error.message);
    return [];
  }
};

// Auto-reply to a review
const autoReply = async (user, review) => {
  try {
    let replyContent, replyMethod, templateId;
    
    if (user.replyMode === 'ai') {
      replyContent = await generateAIReply(user, review);
      replyMethod = 'ai';
    } else if (user.replyMode === 'template') {
      const result = await generateTemplateReply(user, review);
      replyContent = result.reply;
      templateId = result.templateId;
      replyMethod = 'template';
    } else {
      // Manual mode - don't auto-reply
      return null;
    }
    
    // Post reply to Google
    const oauth2Client = getOAuth2Client(user);
    const mybusiness = google.mybusiness({ version: 'v4', auth: oauth2Client });
    
    await mybusiness.accounts.locations.reviews.updateReply({
      name: review.googleReviewId + '/reply',
      requestBody: { comment: replyContent }
    });
    
    // Update review record
    await Review.findByIdAndUpdate(review._id, {
      replyStatus: 'replied',
      replyContent,
      replyMethod,
      repliedAt: new Date(),
      templateUsed: templateId,
      aiProviderUsed: replyMethod === 'ai' ? user.aiProvider : null
    });
    
    console.log(`Auto-replied to review ${review._id} for user ${user._id}`);
    return replyContent;
  } catch (error) {
    console.error(`Error auto-replying to review ${review._id}:`, error.message);
    
    await Review.findByIdAndUpdate(review._id, {
      replyStatus: 'failed',
      replyError: error.message
    });
    
    return null;
  }
};

// Main automation job
const runAutomation = async () => {
  console.log('[Automation] Starting review check...');
  
  try {
    // Get all active users with automation enabled
    const users = await User.find({
      isActive: true,
      googleAccessToken: { $ne: null },
      replyMode: { $in: ['ai', 'template'] }
    });
    
    console.log(`[Automation] Checking ${users.length} users...`);
    
    for (const user of users) {
      // Check if user has active access
      if (!user.hasActiveAccess()) continue;
      
      // Fetch new reviews
      const newReviews = await fetchNewReviews(user);
      console.log(`[Automation] User ${user.email}: ${newReviews.length} new reviews`);
      
      // Auto-reply to each new review
      for (const review of newReviews) {
        await autoReply(user, review);
        // Add delay between replies to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('[Automation] Review check complete');
  } catch (error) {
    console.error('[Automation] Error:', error.message);
  }
};

// Schedule automation (every 15 minutes)
const startAutomationJob = () => {
  cron.schedule('*/15 * * * *', runAutomation);
  console.log('[Automation] Scheduled to run every 15 minutes');
};

module.exports = { startAutomationJob, runAutomation };

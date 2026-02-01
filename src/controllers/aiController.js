const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const User = require('../models/User');
const Review = require('../models/Review');
const ReplyTemplate = require('../models/ReplyTemplate');

// AI Provider handlers
const aiProviders = {
  openai: async (apiKey, prompt) => {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500
    });
    return response.choices[0].message.content.trim();
  },

  gemini: async (apiKey, prompt) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  },

  claude: async (apiKey, prompt) => {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });
    return response.content[0].text.trim();
  },

  glm: async (apiKey, prompt) => {
    // GLM (Zhipu AI) API
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    return data.choices[0].message.content.trim();
  }
};

// Generate reply using AI
const generateAIReply = async (user, review) => {
  if (!user.aiProvider || !user.aiApiKey) {
    throw new Error('AI provider not configured');
  }

  const handler = aiProviders[user.aiProvider];
  if (!handler) {
    throw new Error(`Unsupported AI provider: ${user.aiProvider}`);
  }

  const prompt = `You are a professional business owner responding to a Google review.

Review Details:
- Reviewer Name: ${review.reviewerName}
- Star Rating: ${review.starRating}/5
- Review Comment: ${review.comment || '(No comment, just a star rating)'}

Instructions:
- Write a professional, warm, and authentic reply
- Thank the reviewer for their feedback
- If positive (4-5 stars): Express gratitude and invite them back
- If neutral (3 stars): Thank them and ask how you could improve
- If negative (1-2 stars): Apologize sincerely, offer to make things right, provide a way to contact you
- Keep the reply between 2-4 sentences
- Don't be overly formal or use corporate jargon
- Personalize when possible using reviewer's name

Write only the reply text, nothing else:`;

  return await handler(user.aiApiKey, prompt);
};

// Generate reply using template
const generateTemplateReply = async (user, review) => {
  const template = await ReplyTemplate.findOne({
    user: user._id,
    isActive: true,
    'starRating.min': { $lte: review.starRating },
    'starRating.max': { $gte: review.starRating }
  }).sort({ usageCount: 1 }); // Use least used template for variety

  if (!template) {
    throw new Error('No matching template found');
  }

  // Replace placeholders
  let reply = template.content;
  reply = reply.replace(/\{\{reviewer_name\}\}/gi, review.reviewerName);
  reply = reply.replace(/\{\{business_name\}\}/gi, review.locationName || 'our business');
  reply = reply.replace(/\{\{rating\}\}/gi, review.starRating.toString());

  // Increment usage count
  await ReplyTemplate.findByIdAndUpdate(template._id, { $inc: { usageCount: 1 } });

  return { reply, templateId: template._id };
};

// @desc    Generate reply for a review
// @route   POST /api/ai/generate-reply
// @access  Private
const generateReply = async (req, res) => {
  try {
    const { reviewId, method } = req.body;
    const useMethod = method || req.user.replyMode;

    const review = await Review.findOne({ _id: reviewId, user: req.user._id });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    let reply, templateId = null;

    if (useMethod === 'ai') {
      reply = await generateAIReply(req.user, review);
    } else if (useMethod === 'template') {
      const result = await generateTemplateReply(req.user, review);
      reply = result.reply;
      templateId = result.templateId;
    } else {
      return res.status(400).json({ message: 'Invalid reply method' });
    }

    res.json({
      reply,
      method: useMethod,
      templateId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate reply', error: error.message });
  }
};

// @desc    Test AI configuration
// @route   POST /api/ai/test
// @access  Private
const testAIConfig = async (req, res) => {
  try {
    const { provider, apiKey } = req.body;

    const handler = aiProviders[provider];
    if (!handler) {
      return res.status(400).json({ message: `Unsupported AI provider: ${provider}` });
    }

    const testPrompt = 'Say "Hello! Your API key is working correctly." in exactly those words.';
    const response = await handler(apiKey, testPrompt);

    res.json({
      success: true,
      message: 'AI configuration is working',
      testResponse: response
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      success: false,
      message: 'AI configuration test failed',
      error: error.message
    });
  }
};

// @desc    Get supported AI providers
// @route   GET /api/ai/providers
// @access  Public
const getProviders = async (req, res) => {
  res.json([
    { id: 'openai', name: 'OpenAI', description: 'GPT-4o Mini' },
    { id: 'gemini', name: 'Google Gemini', description: 'Gemini Pro' },
    { id: 'claude', name: 'Anthropic Claude', description: 'Claude 3 Haiku' },
    { id: 'glm', name: 'Zhipu GLM', description: 'GLM-4' }
  ]);
};

module.exports = {
  generateReply,
  testAIConfig,
  getProviders,
  generateAIReply,
  generateTemplateReply
};

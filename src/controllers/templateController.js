const ReplyTemplate = require('../models/ReplyTemplate');

// @desc    Get all templates
// @route   GET /api/templates
// @access  Private
const getTemplates = async (req, res) => {
  try {
    const templates = await ReplyTemplate.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create template
// @route   POST /api/templates
// @access  Private
const createTemplate = async (req, res) => {
  try {
    const { name, category, starRating, content } = req.body;

    const template = await ReplyTemplate.create({
      user: req.user._id,
      name,
      category: category || 'custom',
      starRating: starRating || { min: 1, max: 5 },
      content
    });

    res.status(201).json(template);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update template
// @route   PUT /api/templates/:id
// @access  Private
const updateTemplate = async (req, res) => {
  try {
    const { name, category, starRating, content, isActive } = req.body;

    const template = await ReplyTemplate.findOne({ _id: req.params.id, user: req.user._id });
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (name !== undefined) template.name = name;
    if (category !== undefined) template.category = category;
    if (starRating !== undefined) template.starRating = starRating;
    if (content !== undefined) template.content = content;
    if (isActive !== undefined) template.isActive = isActive;

    await template.save();
    res.json(template);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete template
// @route   DELETE /api/templates/:id
// @access  Private
const deleteTemplate = async (req, res) => {
  try {
    const template = await ReplyTemplate.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.json({ message: 'Template deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get matching template for a review
// @route   POST /api/templates/match
// @access  Private
const matchTemplate = async (req, res) => {
  try {
    const { starRating } = req.body;

    // Find matching template based on star rating
    const template = await ReplyTemplate.findOne({
      user: req.user._id,
      isActive: true,
      'starRating.min': { $lte: starRating },
      'starRating.max': { $gte: starRating }
    }).sort({ usageCount: -1 });

    if (!template) {
      return res.status(404).json({ message: 'No matching template found' });
    }

    res.json(template);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  matchTemplate
};

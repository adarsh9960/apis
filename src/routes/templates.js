const express = require('express');
const router = express.Router();
const {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  matchTemplate
} = require('../controllers/templateController');
const { protect, requireActiveSubscription } = require('../middleware/auth');

router.use(protect, requireActiveSubscription);

router.get('/', getTemplates);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);
router.post('/match', matchTemplate);

module.exports = router;

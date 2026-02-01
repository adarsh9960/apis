const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserDetails,
  createUser,
  updateUser,
  deleteUser,
  getDashboardStats,
  getAppConfig,
  updateAppConfig
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

// All routes require admin
router.use(protect, adminOnly);

router.get('/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.post('/users', createUser);
router.get('/users/:id', getUserDetails);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.get('/config', getAppConfig);
router.put('/config', updateAppConfig);

module.exports = router;

const express = require('express');
const analyticsController = require('../controllers/analytics.controller');
const aiWorkflowController = require('../controllers/aiWorkflow.controller');
const { protect, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/dashboard', protect, requireRole(['manager', 'admin']), aiWorkflowController.getDashboardAnalytics);
router.get('/', protect, requireRole('admin'), analyticsController.getAnalytics);
router.get('/manager', protect, requireRole(['manager', 'admin']), analyticsController.getManagerAnalytics);

module.exports = router;

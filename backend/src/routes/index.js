const express = require('express');
const { getDatabaseStatus } = require('../db/connection');
const authRoutes = require('./auth.routes');
const requestRoutes = require('./request.routes');
const notificationRoutes = require('./notification.routes');
const analyticsRoutes = require('./analytics.routes');
const intelligenceRoutes = require('./intelligence.routes');
const uploadRoutes = require('./upload.routes');
const userRoutes = require('./user.routes');
const exportRoutes = require('./export.routes');
const escalateRoutes = require('./escalate.routes');
const compatRoutes = require('./compat.routes');

const router = express.Router();

router.get('/health', (_req, res) =>
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'Infosys Approval System API',
      database: getDatabaseStatus(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  })
);

router.use('/auth', authRoutes);
router.use('/requests', requestRoutes);
router.use('/notifications', notificationRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/intelligence', intelligenceRoutes);
router.use('/uploads', uploadRoutes);
router.use('/users', userRoutes);
router.use('/exports', exportRoutes);
router.use('/escalate', escalateRoutes);
router.use('/', compatRoutes);

module.exports = router;

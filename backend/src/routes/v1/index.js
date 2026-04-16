const express = require('express');
const { getDatabaseStatus } = require('../../db/connection');
const authRoutes = require('./auth.routes');
const requestRoutes = require('./request.routes');
const approvalRoutes = require('./approval.routes');
const commentRoutes = require('./comment.routes');
const dashboardRoutes = require('./dashboard.routes');
const setupRoutes = require('./setup.routes');

const router = express.Router();

router.get('/health', (_req, res) =>
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'Infosys Approval System API v1',
      database: getDatabaseStatus(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  })
);

router.use('/auth', authRoutes);
router.use('/requests', requestRoutes);
router.use('/approvals', approvalRoutes);
router.use('/', commentRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/setup', setupRoutes);

module.exports = router;

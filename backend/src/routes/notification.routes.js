const express = require('express');
const Joi = require('joi');
const notificationController = require('../controllers/notification.controller');
const { protect, requireRole } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

router.use(protect);
router.get('/mine', notificationController.getMyNotifications);
router.get('/mine/grouped', notificationController.getMyNotificationsGrouped);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/read-all', notificationController.markAllAsRead);
router.post('/digest', notificationController.sendDailyDigest);
router.post('/overdue-check', requireRole('admin'), notificationController.runOverdueCheck);
router.post('/pending-reminder', requireRole(['manager', 'admin']), notificationController.sendPendingReminder);
router.post(
  '/admin-announcement',
  requireRole('admin'),
  validateRequest(
    Joi.object({
      title: Joi.string().min(3).max(140).required(),
      message: Joi.string().min(5).max(2000).required(),
    })
  ),
  notificationController.sendAdminAnnouncement
);
router.post(
  '/simulate-email',
  validateRequest(
    Joi.object({
      subject: Joi.string()
        .max(140)
        .default('Infosys Approval System Notification'),
      body: Joi.string().max(1000).default('This is a simulated email delivery.'),
    })
  ),
  notificationController.simulateEmail
);

module.exports = router;

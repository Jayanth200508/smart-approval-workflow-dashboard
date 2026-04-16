const notificationService = require('../services/notification.service');
const { success } = require('../utils/responseHelpers');

const getMyNotifications = async (req, res) =>
  success(res, notificationService.getMyNotifications(req.user.id));

const getMyNotificationsGrouped = async (req, res) =>
  success(res, notificationService.groupedNotificationsByDate(req.user.id));

const markAsRead = async (req, res) =>
  success(res, notificationService.markOneRead(req.params.id, req.user.id));

const markAllAsRead = async (req, res) => success(res, notificationService.markAllRead(req.user.id));

const runOverdueCheck = async (_req, res) => success(res, notificationService.createOverdueNotifications());

const sendDailyDigest = async (req, res) =>
  success(res, notificationService.createDailyDigest({ userId: req.user.id }), 201);

const sendPendingReminder = async (_req, res) =>
  success(res, await notificationService.createPendingReminderNotifications(), 201);

const sendAdminAnnouncement = async (req, res) =>
  success(
    res,
    await notificationService.sendAdminAnnouncementToAll({
      title: req.body.title,
      message: req.body.message,
      adminName: req.user.name || 'Admin',
    }),
    201
  );

const simulateEmail = async (req, res) =>
  success(
    res,
    notificationService.simulateEmailNotification({
      userId: req.user.id,
      subject: req.body.subject || 'Infosys Approval System Notification',
      body: req.body.body || 'This is a simulated email delivery.',
    }),
    201
  );

module.exports = {
  getMyNotifications,
  getMyNotificationsGrouped,
  markAsRead,
  markAllAsRead,
  runOverdueCheck,
  sendDailyDigest,
  sendPendingReminder,
  sendAdminAnnouncement,
  simulateEmail,
};

const User = require('../models/User');
const logger = require('../utils/logger');
const emailService = require('./emailService');
const {
  createNotification,
  findNotificationsByUserId,
  listRequests,
  markNotificationRead,
  markAllNotificationsRead,
  users,
} = require('../data/mockStore');

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const runAsync = (promise) => {
  Promise.resolve(promise).catch((error) => {
    logger.error('Async notification/email task failed', { error: error.message });
  });
};

const fetchDbUserById = async (userId) => {
  if (!userId || !String(userId).match(/^[0-9a-fA-F]{24}$/)) return null;
  return User.findById(userId).lean();
};

const getUserContact = async (userId) => {
  const dbUser = await fetchDbUserById(userId);
  if (dbUser) {
    return {
      id: String(dbUser._id),
      name: dbUser.name,
      email: normalizeEmail(dbUser.email),
      role: dbUser.role,
      department: dbUser.department,
    };
  }
  const mockUser = users.find((item) => item.id === userId) || null;
  if (!mockUser) return null;
  return {
    id: mockUser.id,
    name: mockUser.name || mockUser.fullName || '',
    email: normalizeEmail(mockUser.email),
    role: mockUser.role,
    department: mockUser.department,
  };
};

const listAllUserContacts = async () => {
  let dbUsers = [];
  try {
    dbUsers = await User.find({}, { name: 1, email: 1, role: 1, department: 1 }).lean();
  } catch (error) {
    logger.warn('Unable to read users from MongoDB for announcement list, using fallback users', {
      error: error.message,
    });
  }
  const dbContacts = dbUsers.map((item) => ({
    id: String(item._id),
    name: item.name,
    email: normalizeEmail(item.email),
    role: item.role,
    department: item.department,
  }));
  const merged = [...dbContacts];
  const existing = new Set(dbContacts.map((item) => item.email));
  users.forEach((item) => {
    const email = normalizeEmail(item.email);
    if (!email || existing.has(email)) return;
    merged.push({
      id: item.id,
      name: item.name || item.fullName || '',
      email,
      role: item.role,
      department: item.department,
    });
  });
  return merged;
};

const getFirstApproverContact = async () => {
  try {
    const dbApprover = await User.findOne({ role: { $in: ['manager', 'approver', 'admin'] } }, { name: 1, email: 1, role: 1, department: 1 })
      .sort({ createdAt: 1 })
      .lean();
    if (dbApprover?.email) {
      return {
        id: String(dbApprover._id),
        name: dbApprover.name,
        email: normalizeEmail(dbApprover.email),
        role: dbApprover.role,
        department: dbApprover.department,
      };
    }
  } catch (error) {
    logger.warn('Unable to resolve approver from DB, using fallback users', { error: error.message });
  }

  const mockApprover = users.find((item) => ['manager', 'approver', 'admin'].includes(item.role));
  if (!mockApprover?.email) return null;
  return {
    id: mockApprover.id,
    name: mockApprover.name || mockApprover.fullName || '',
    email: normalizeEmail(mockApprover.email),
    role: mockApprover.role,
    department: mockApprover.department,
  };
};

const createApprovalNotification = ({ userId, requestTitle, requestId, role = 'Manager', comments = '', nextStep = '' }) => {
  const inApp = createNotification({
    userId,
    type: 'approval',
    title: 'Request Approved - Infosys Approval System',
    message: `Your request '${requestTitle}' has been approved by ${role}. View details.`,
  });

  runAsync(
    getUserContact(userId).then((contact) => {
      if (!contact?.email) return null;
      return emailService.sendApprovalEmail({
        recipient: contact.email,
        requestId,
        approverName: role,
        approvalStage: role,
        comments,
        nextStep: nextStep || 'Workflow updated',
      });
    })
  );
  return inApp;
};

const createRejectionNotification = ({ userId, requestTitle, requestId, rejectorName = '', reason = '' }) => {
  const inApp = createNotification({
    userId,
    type: 'rejection',
    title: 'Request Rejected - Infosys Approval System',
    message: `Your request '${requestTitle}' was rejected. Please review the comments and resubmit if necessary.`,
  });

  runAsync(
    getUserContact(userId).then((contact) => {
      if (!contact?.email) return null;
      return emailService.sendRejectionEmail({
        recipient: contact.email,
        requestId,
        rejectorName,
        reason,
        suggestion: 'Please review the feedback and resubmit if necessary.',
      });
    })
  );
  return inApp;
};

const createInfoNotification = ({ userId, title, message }) =>
  createNotification({
    userId,
    type: 'info',
    title,
    message,
  });

const sendRequestSubmissionEmail = ({ approverId, requesterName, requestId, requestTitle, requestDescription, department, priority, submittedAt }) => {
  runAsync(
    Promise.resolve(approverId ? getUserContact(approverId) : getFirstApproverContact()).then((approver) => {
      if (!approver?.email) return null;
      return emailService.sendRequestSubmissionEmail({
        recipient: approver.email,
        requesterName,
        requestId,
        requestTitle,
        requestDescription,
        department,
        priority,
        submittedAt,
      });
    })
  );
};

const sendApprovalStageEmail = ({ recipientUserId, requestId, approverName, approvalStage, comments, nextStep }) => {
  runAsync(
    getUserContact(recipientUserId).then((contact) => {
      if (!contact?.email) return null;
      return emailService.sendApprovalEmail({
        recipient: contact.email,
        requestId,
        approverName,
        approvalStage,
        comments,
        nextStep,
      });
    })
  );
};

const sendRejectionStageEmail = ({ recipientUserId, requestId, rejectorName, reason }) => {
  runAsync(
    getUserContact(recipientUserId).then((contact) => {
      if (!contact?.email) return null;
      return emailService.sendRejectionEmail({
        recipient: contact.email,
        requestId,
        rejectorName,
        reason,
      });
    })
  );
};

const sendModificationNeededEmail = ({ recipientUserId, requestId, reviewerName, comments }) => {
  runAsync(
    getUserContact(recipientUserId).then((contact) => {
      if (!contact?.email) return null;
      return emailService.sendModificationRequestEmail({
        recipient: contact.email,
        requestId,
        reviewerName,
        comments,
      });
    })
  );
};

const getMyNotifications = (userId) => findNotificationsByUserId(userId);

const groupedNotificationsByDate = (userId) => {
  const grouped = findNotificationsByUserId(userId).reduce((acc, item) => {
    const key = new Date(item.createdAt).toISOString().slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  return grouped;
};

const markOneRead = (notificationId, userId) => {
  const updated = markNotificationRead(notificationId, userId);
  if (!updated) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }
  return updated;
};

const markAllRead = (userId) => {
  markAllNotificationsRead(userId);
  return { updated: true };
};

const createOverdueNotifications = () => {
  const now = Date.now();
  const overdue = listRequests().filter(
    (item) =>
      ['pending', 'admin_review'].includes(item.status) &&
      item.dueAt &&
      new Date(item.dueAt).getTime() < now
  );

  const admins = users.filter((item) => item.role === 'admin');
  admins.forEach((admin) => {
    overdue.forEach((request) => {
      createNotification({
        userId: admin.id,
        type: 'warning',
        title: 'Overdue Approval - Infosys Approval System',
        message: `Request '${request.title}' is overdue and still awaiting decision.`,
      });
    });
  });

  return { overdueCount: overdue.length };
};

const createDailyDigest = ({ userId }) => {
  const items = findNotificationsByUserId(userId);
  const unread = items.filter((item) => !item.isRead).length;
  return createNotification({
    userId,
    type: 'digest',
    title: 'Daily Digest - Infosys Approval System',
    message: `You have ${unread} unread notifications and ${items.length} total updates today.`,
  });
};

const createPendingReminderNotifications = async () => {
  const now = Date.now();
  const stale = listRequests().filter((item) => {
    if (!['pending', 'admin_review'].includes(item.status)) return false;
    const createdMs = new Date(item.createdAt || item.submittedAt || Date.now()).getTime();
    return now - createdMs >= 24 * 60 * 60 * 1000;
  });

  let sent = 0;
  for (const request of stale) {
    const approverId =
      request.status === 'admin_review'
        ? users.find((item) => item.role === 'admin')?.id
        : request.assignedManagerId || users.find((item) => item.role === 'manager')?.id;

    if (!approverId) continue;
    createNotification({
      userId: approverId,
      type: 'reminder',
      title: 'Pending Approval Reminder - Infosys Approval System',
      message: `Request '${request.title}' is pending for more than 24 hours.`,
    });

    const approver = await getUserContact(approverId);
    if (!approver?.email) continue;
    const pendingHours = Math.max(
      24,
      Math.round((now - new Date(request.createdAt || request.submittedAt || Date.now()).getTime()) / (1000 * 60 * 60))
    );
    const emailResult = await emailService.sendPendingReminder({
      recipient: approver.email,
      requestId: request.id,
      requesterName: request.requesterName,
      submittedAt: request.createdAt || request.submittedAt,
      pendingHours,
    });
    if (emailResult?.status === 'sent') sent += 1;
  }

  return { pendingCount: stale.length, reminderEmailsQueued: sent };
};

const sendAdminAnnouncementToAll = async ({ title, message, adminName }) => {
  const contacts = await listAllUserContacts();
  const recipients = contacts.filter((item) => item.email);

  await Promise.all(
    recipients.map((item) =>
      emailService.sendAdminAnnouncement({
        recipient: item.email,
        title,
        message,
        adminName,
      })
    )
  );

  return { totalRecipients: recipients.length };
};

const simulateEmailNotification = ({ userId, subject, body }) => {
  const notification = createNotification({
    userId,
    type: 'email_simulation',
    title: `Email Simulated - ${subject}`,
    message: body,
  });

  runAsync(
    getUserContact(userId).then((contact) => {
      if (!contact?.email) return null;
      return emailService.sendEmail({
        recipient: contact.email,
        subject,
        html: `<p>${String(body || '').replace(/[<>]/g, '')}</p>`,
        eventType: 'simulation',
      });
    })
  );

  return notification;
};

module.exports = {
  createApprovalNotification,
  createRejectionNotification,
  createInfoNotification,
  sendRequestSubmissionEmail,
  sendApprovalStageEmail,
  sendRejectionStageEmail,
  sendModificationNeededEmail,
  getMyNotifications,
  groupedNotificationsByDate,
  markOneRead,
  markAllRead,
  createOverdueNotifications,
  createDailyDigest,
  createPendingReminderNotifications,
  sendAdminAnnouncementToAll,
  simulateEmailNotification,
};

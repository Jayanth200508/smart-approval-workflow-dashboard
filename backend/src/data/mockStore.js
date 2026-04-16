const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const users = [];
const requests = [];
const notifications = [];
const loginActivities = [];
const delegations = [];
const approvalConfirmations = [];

const createId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const hashTimelineEvent = ({ requestId, status, byUser, role, comment, timestamp, prevHash }) =>
  crypto
    .createHash('sha256')
    .update([requestId, status, byUser, role, comment, timestamp, prevHash || ''].join('|'))
    .digest('hex');

const sanitizeUser = (user) => {
  const safeUser = { ...user };
  delete safeUser.password;
  return safeUser;
};

const seedDemoUsers = () => {
  if (users.length) return;

  // TODO: Replace seed data with MongoDB seed scripts during DB integration.
  users.push(
    {
      id: 'usr_employee',
      name: 'Demo Employee',
      email: 'employee@flowpilot.com',
      role: 'employee',
      department: 'Operations',
      password: bcrypt.hashSync('password123', 10),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_manager',
      name: 'Demo Manager',
      email: 'manager@flowpilot.com',
      role: 'manager',
      department: 'Finance',
      password: bcrypt.hashSync('password123', 10),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_admin',
      name: 'Demo Admin',
      email: 'admin@flowpilot.com',
      role: 'admin',
      department: 'Executive',
      password: bcrypt.hashSync('password123', 10),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_employee_smartflow',
      name: 'Demo Employee',
      email: 'employee@smartflow.com',
      role: 'employee',
      department: 'Operations',
      password: bcrypt.hashSync('password123', 10),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_manager_smartflow',
      name: 'Demo Manager',
      email: 'manager@smartflow.com',
      role: 'manager',
      department: 'Finance',
      password: bcrypt.hashSync('password123', 10),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_admin_smartflow',
      name: 'Demo Admin',
      email: 'admin@smartflow.com',
      role: 'admin',
      department: 'Executive',
      password: bcrypt.hashSync('password123', 10),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_admin_bitsathy',
      name: 'Jayanth Admin',
      email: 'jayanth.se23@bitsathy.ac.in',
      role: 'admin',
      department: 'Executive',
      password: bcrypt.hashSync('1234qwer', 10),
      createdAt: new Date().toISOString(),
    }
  );
};

const findUserByEmail = (email) => users.find((item) => item.email.toLowerCase() === email.toLowerCase()) || null;
const findUserById = (id) => users.find((item) => item.id === id) || null;

const createUser = ({ name, email, role, password, department = 'General' }) => {
  const user = {
    id: createId('usr'),
    name,
    email: email.toLowerCase(),
    role,
    department,
    password,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  return user;
};

const createRequest = (payload) => {
  const now = new Date().toISOString();
  const firstHash = hashTimelineEvent({
    requestId: payload.id || 'new',
    status: 'submission',
    byUser: payload.requesterId,
    role: payload.requesterRole || 'employee',
    comment: 'Request submitted',
    timestamp: now,
    prevHash: '',
  });
  const request = {
    id: createId('req'),
    title: payload.title,
    type: payload.type,
    department: payload.department,
    amount: payload.amount,
    priority: payload.priority,
    urgency: payload.urgency || 'normal',
    description: payload.description || '',
    attachments: payload.attachments || [],
    requesterId: payload.requesterId,
    requesterName: payload.requesterName || '',
    requesterDepartment: payload.requesterDepartment || payload.department,
    status: 'pending',
    timeline: [
      {
        status: 'submission',
        byUser: payload.requesterId,
        role: payload.requesterRole || 'employee',
        actorName: payload.requesterName || '',
        comment: 'Request submitted',
        timestamp: now,
        hash: firstHash,
      },
    ],
    auditTrail: [
      {
        action: 'submitted',
        actorId: payload.requesterId,
        actorName: payload.requesterName || '',
        actorRole: payload.requesterRole || 'employee',
        comment: 'Request submitted',
        timestamp: now,
      },
    ],
    dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    createdAt: now,
    updatedAt: now,
  };
  request.timeline[0].hash = hashTimelineEvent({
    requestId: request.id,
    status: request.timeline[0].status,
    byUser: request.timeline[0].byUser,
    role: request.timeline[0].role,
    comment: request.timeline[0].comment,
    timestamp: request.timeline[0].timestamp,
    prevHash: '',
  });
  requests.push(request);
  return request;
};

const findRequestById = (id) => requests.find((item) => item.id === id) || null;
const findRequestsByUserId = (userId) => requests.filter((item) => item.requesterId === userId);
const findPendingRequestsForManager = () => requests.filter((item) => item.status === 'pending');
const listRequests = () => requests;

const updateRequest = (id, updater) => {
  const request = findRequestById(id);
  if (!request) return null;
  updater(request);
  request.updatedAt = new Date().toISOString();
  return request;
};

const createLoginActivity = ({ userId, ip, userAgent }) => {
  const activity = {
    id: createId('log'),
    userId,
    ip: ip || '',
    userAgent: userAgent || '',
    timestamp: new Date().toISOString(),
  };
  loginActivities.push(activity);
  return activity;
};

const listLoginActivitiesByUserId = (userId) =>
  loginActivities
    .filter((item) => item.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 20);

const setDelegation = ({ delegatorId, delegateId, activeUntil }) => {
  const existing = delegations.find((item) => item.delegatorId === delegatorId);
  if (existing) {
    existing.delegateId = delegateId;
    existing.activeUntil = activeUntil;
    existing.updatedAt = new Date().toISOString();
    return existing;
  }

  const created = {
    id: createId('dlg'),
    delegatorId,
    delegateId,
    activeUntil,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  delegations.push(created);
  return created;
};

const findDelegationByDelegatorId = (delegatorId) =>
  delegations.find((item) => item.delegatorId === delegatorId) || null;

const removeDelegation = (delegatorId) => {
  const index = delegations.findIndex((item) => item.delegatorId === delegatorId);
  if (index < 0) return null;
  const [removed] = delegations.splice(index, 1);
  return removed;
};

const createApprovalConfirmation = ({ requestId, approverId }) => {
  const token = `${createId('cnf')}-${Date.now()}`;
  const entry = {
    id: createId('ctk'),
    requestId,
    approverId,
    token,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };
  approvalConfirmations.push(entry);
  return entry;
};

const consumeApprovalConfirmation = ({ requestId, approverId, token }) => {
  const index = approvalConfirmations.findIndex(
    (item) =>
      item.requestId === requestId &&
      item.approverId === approverId &&
      item.token === token &&
      new Date(item.expiresAt).getTime() > Date.now()
  );
  if (index < 0) return null;
  const [matched] = approvalConfirmations.splice(index, 1);
  return matched;
};

const createNotification = ({ userId, title, message, type }) => {
  const notification = {
    id: createId('noti'),
    userId,
    title,
    message,
    type,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  notifications.push(notification);
  return notification;
};

const findNotificationsByUserId = (userId) => notifications.filter((item) => item.userId === userId);
const findNotificationById = (id) => notifications.find((item) => item.id === id) || null;

const markNotificationRead = (id, userId) => {
  const item = findNotificationById(id);
  if (!item || item.userId !== userId) return null;
  item.isRead = true;
  return item;
};

const markAllNotificationsRead = (userId) => {
  notifications.forEach((item) => {
    if (item.userId === userId) item.isRead = true;
  });
};

const updateUser = (id, updater) => {
  const user = findUserById(id);
  if (!user) return null;
  updater(user);
  return user;
};

const deleteUser = (id) => {
  const index = users.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const [removed] = users.splice(index, 1);
  return removed;
};

const replaceUsers = (nextUsers = []) => {
  users.length = 0;
  nextUsers.forEach((item) => users.push(item));
  return users;
};

module.exports = {
  users,
  requests,
  notifications,
  loginActivities,
  delegations,
  approvalConfirmations,
  seedDemoUsers,
  sanitizeUser,
  findUserByEmail,
  findUserById,
  createUser,
  createRequest,
  findRequestById,
  findRequestsByUserId,
  findPendingRequestsForManager,
  listRequests,
  updateRequest,
  updateUser,
  deleteUser,
  replaceUsers,
  createLoginActivity,
  listLoginActivitiesByUserId,
  setDelegation,
  findDelegationByDelegatorId,
  removeDelegation,
  createApprovalConfirmation,
  consumeApprovalConfirmation,
  createNotification,
  findNotificationsByUserId,
  findNotificationById,
  markNotificationRead,
  markAllNotificationsRead,
};

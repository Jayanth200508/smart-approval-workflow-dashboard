const mongoose = require('mongoose');
const ApprovalType = require('../models/ApprovalType');
const Attachment = require('../models/Attachment');
const AuditLog = require('../models/AuditLog');
const Comment = require('../models/Comment');
const Department = require('../models/Department');
const Notification = require('../models/Notification');
const Request = require('../models/Request');
const RequestApproval = require('../models/RequestApproval');
const Role = require('../models/Role');
const StatusHistory = require('../models/StatusHistory');
const User = require('../models/User');
const WorkflowLevel = require('../models/WorkflowLevel');

const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

const createAuditLog = async ({ actorUserId, entityType, entityId, action, meta = {}, ipAddress, userAgent }) => {
  await AuditLog.create({
    actorUserId: actorUserId ? toObjectId(actorUserId) : null,
    entityType,
    entityId: String(entityId),
    action,
    meta,
    ipAddress: ipAddress || '',
    userAgent: userAgent || '',
  });
};

const addStatusHistory = async ({ requestId, fromStatus, toStatus, changedBy, reason }) => {
  await StatusHistory.create({
    requestId: toObjectId(requestId),
    fromStatus: fromStatus || '',
    toStatus,
    changedBy: changedBy ? toObjectId(changedBy) : null,
    reason: reason || '',
    changedAt: new Date(),
  });
};

const createNotification = async ({ userId, requestId, type, message }) => {
  if (!userId) return;
  await Notification.create({
    userId: toObjectId(userId),
    requestId: requestId ? toObjectId(requestId) : null,
    type,
    message,
  });
};

const getWorkflowForRequest = async ({ approvalTypeId, departmentId }) => {
  let levels = await WorkflowLevel.find({
    approvalTypeId: toObjectId(approvalTypeId),
    departmentId: departmentId ? toObjectId(departmentId) : null,
  })
    .sort({ levelNumber: 1 })
    .lean();

  if (!levels.length) {
    levels = await WorkflowLevel.find({
      approvalTypeId: toObjectId(approvalTypeId),
      departmentId: null,
    })
      .sort({ levelNumber: 1 })
      .lean();
  }

  if (!levels.length) {
    const error = new Error('No workflow levels configured for this approval type');
    error.statusCode = 422;
    throw error;
  }
  return levels;
};

const findApproverForLevel = async ({ level, departmentId }) => {
  if (level.approverUserId) {
    const direct = await User.findById(level.approverUserId).lean();
    if (direct) return direct;
  }

  if (!level.approverRoleId) return null;
  const role = await Role.findById(level.approverRoleId).lean();
  if (!role) return null;

  const roleName = String(role.name || '').toLowerCase();
  const roleQuery =
    roleName === 'approver' ? { $in: ['approver', 'manager'] } : roleName;
  const activeFilter = { $or: [{ isActive: true }, { isActive: { $exists: false } }] };

  if (roleName === 'approver') {
    const preferredManager = await User.findOne({
      email: 'manager@flowpilot.com',
      role: { $in: ['approver', 'manager'] },
      ...activeFilter,
    }).lean();
    if (preferredManager) return preferredManager;
  }

  if (roleName === 'admin') {
    const preferredAdmin = await User.findOne({
      email: 'admin@flowpilot.com',
      role: 'admin',
      ...activeFilter,
    }).lean();
    if (preferredAdmin) return preferredAdmin;
  }

  let scoped = await User.findOne({
    role: roleQuery,
    ...activeFilter,
    ...(departmentId ? { $or: [{ departmentId: toObjectId(departmentId) }, { departmentId: null }] } : {}),
  })
    .sort({ createdAt: 1 })
    .lean();

  if (!scoped) {
    scoped = await User.findOne({
      role: roleQuery,
      ...activeFilter,
    })
      .sort({ createdAt: 1 })
      .lean();
  }

  return scoped || null;
};

const generateRequestNumber = async () => {
  const prefix = `REQ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  const countToday = await Request.countDocuments({
    requestNumber: { $regex: `^${prefix}-` },
  });
  const sequence = String(countToday + 1).padStart(4, '0');
  return `${prefix}-${sequence}`;
};

const createRequest = async ({ actor, payload, ipAddress, userAgent }) => {
  const requester = await User.findById(actor.id).lean();
  if (!requester) {
    const error = new Error('Requester not found');
    error.statusCode = 404;
    throw error;
  }

  const approvalType = await ApprovalType.findById(payload.approvalTypeId).lean();
  if (!approvalType || !approvalType.isActive) {
    const error = new Error('Invalid or inactive approval type');
    error.statusCode = 422;
    throw error;
  }

  const departmentId = payload.departmentId || requester.departmentId;
  if (!departmentId) {
    const error = new Error('departmentId is required');
    error.statusCode = 422;
    throw error;
  }

  const department = await Department.findById(departmentId).lean();
  if (!department) {
    const error = new Error('Department not found');
    error.statusCode = 422;
    throw error;
  }

  const workflowLevels = await getWorkflowForRequest({
    approvalTypeId: payload.approvalTypeId,
    departmentId,
  });
  const firstLevel = workflowLevels[0];
  const firstApprover = await findApproverForLevel({ level: firstLevel, departmentId });

  if (!firstApprover) {
    const error = new Error('No approver found for first workflow level');
    error.statusCode = 422;
    throw error;
  }

  const requestNumber = await generateRequestNumber();
  const request = await Request.create({
    requestNumber,
    title: payload.title,
    description: payload.description || '',
    requesterId: toObjectId(actor.id),
    departmentId: toObjectId(departmentId),
    approvalTypeId: toObjectId(payload.approvalTypeId),
    currentLevel: firstLevel.levelNumber,
    currentApproverId: toObjectId(firstApprover._id),
    status: 'PENDING',
    submittedAt: new Date(),
  });

  await RequestApproval.create({
    requestId: request._id,
    levelNumber: firstLevel.levelNumber,
    approverId: firstApprover._id,
    action: 'PENDING',
  });

  if (Array.isArray(payload.attachments) && payload.attachments.length) {
    const attachmentDocs = payload.attachments.map((item) => ({
      requestId: request._id,
      uploadedBy: toObjectId(actor.id),
      fileName: item.fileName,
      fileUrl: item.fileUrl,
      mimeType: item.mimeType || '',
      fileSize: Number(item.fileSize || 0),
    }));
    await Attachment.insertMany(attachmentDocs);
  }

  await addStatusHistory({
    requestId: request._id,
    fromStatus: '',
    toStatus: 'PENDING',
    changedBy: actor.id,
    reason: 'Request submitted',
  });

  await createNotification({
    userId: firstApprover._id,
    requestId: request._id,
    type: 'APPROVAL_NEEDED',
    message: `New request "${request.title}" needs your approval.`,
  });

  await createNotification({
    userId: actor.id,
    requestId: request._id,
    type: 'REQUEST_SUBMITTED',
    message: `Your request "${request.title}" has been submitted.`,
  });

  await createAuditLog({
    actorUserId: actor.id,
    entityType: 'REQUEST',
    entityId: request._id,
    action: 'CREATE',
    meta: {
      requestNumber,
      approvalTypeId: String(payload.approvalTypeId),
      departmentId: String(departmentId),
    },
    ipAddress,
    userAgent,
  });

  return request;
};

const ensureCanViewRequest = ({ actor, request }) => {
  const isAdmin = actor.role === 'admin';
  const isRequester = String(request.requesterId) === String(actor.id);
  if (isAdmin || isRequester) return;
};

const getRequestById = async ({ requestId, actor }) => {
  const request = await Request.findById(requestId)
    .populate('requesterId', 'name email employeeId role department')
    .populate('departmentId', 'name code')
    .populate('approvalTypeId', 'name')
    .populate('currentApproverId', 'name email role')
    .lean();
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }

  if (actor.role !== 'admin' && String(request.requesterId?._id || request.requesterId) !== String(actor.id)) {
    const pending = await RequestApproval.findOne({
      requestId: toObjectId(requestId),
      approverId: toObjectId(actor.id),
    }).lean();
    if (!pending) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }
  }

  const [approvals, comments, attachments, statusHistory] = await Promise.all([
    RequestApproval.find({ requestId: request._id })
      .populate('approverId', 'name email role')
      .sort({ levelNumber: 1 })
      .lean(),
    Comment.find({ requestId: request._id })
      .populate('userId', 'name email role')
      .sort({ createdAt: 1 })
      .lean(),
    Attachment.find({ requestId: request._id }).sort({ createdAt: 1 }).lean(),
    StatusHistory.find({ requestId: request._id })
      .populate('changedBy', 'name email role')
      .sort({ changedAt: 1 })
      .lean(),
  ]);

  return {
    ...request,
    approvals,
    comments,
    attachments,
    statusHistory,
  };
};

const getRequests = async ({ actor, query = {} }) => {
  const filter = {};
  if (query.status) filter.status = String(query.status).toUpperCase();
  if (query.approvalTypeId) filter.approvalTypeId = toObjectId(query.approvalTypeId);
  if (query.departmentId) filter.departmentId = toObjectId(query.departmentId);

  if (actor.role === 'employee') {
    filter.requesterId = toObjectId(actor.id);
  } else if (actor.role === 'approver' || actor.role === 'manager') {
    const approvalRows = await RequestApproval.find({
      approverId: toObjectId(actor.id),
      action: 'PENDING',
    })
      .select('requestId')
      .lean();
    const requestIds = approvalRows.map((row) => row.requestId);
    filter._id = { $in: requestIds };
  }

  return Request.find(filter)
    .populate('requesterId', 'name email employeeId role')
    .populate('approvalTypeId', 'name')
    .populate('departmentId', 'name code')
    .sort({ createdAt: -1 })
    .lean();
};

const getMyRequests = async ({ actor, query = {} }) => {
  return getRequests({ actor: { ...actor, role: 'employee' }, query });
};

const resolveNextLevel = async ({ request, workflowLevels, actor, ipAddress, userAgent }) => {
  const currentIndex = workflowLevels.findIndex((item) => item.levelNumber === request.currentLevel);
  const nextLevel = workflowLevels[currentIndex + 1];

  if (!nextLevel) {
    const previousStatus = request.status;
    request.status = 'APPROVED';
    request.finalizedAt = new Date();
    request.currentApproverId = null;
    await request.save();

    await addStatusHistory({
      requestId: request._id,
      fromStatus: previousStatus,
      toStatus: 'APPROVED',
      changedBy: actor.id,
      reason: 'All workflow levels approved',
    });

    await createNotification({
      userId: request.requesterId,
      requestId: request._id,
      type: 'REQUEST_APPROVED',
      message: `Your request "${request.title}" has been approved.`,
    });

    await createAuditLog({
      actorUserId: actor.id,
      entityType: 'REQUEST',
      entityId: request._id,
      action: 'FINAL_APPROVE',
      meta: { level: request.currentLevel },
      ipAddress,
      userAgent,
    });

    return request;
  }

  const nextApprover = await findApproverForLevel({
    level: nextLevel,
    departmentId: request.departmentId,
  });
  if (!nextApprover) {
    const error = new Error(`No approver found for level ${nextLevel.levelNumber}`);
    error.statusCode = 422;
    throw error;
  }

  await RequestApproval.create({
    requestId: request._id,
    levelNumber: nextLevel.levelNumber,
    approverId: nextApprover._id,
    action: 'PENDING',
  });

  request.currentLevel = nextLevel.levelNumber;
  request.currentApproverId = nextApprover._id;
  await request.save();

  await addStatusHistory({
    requestId: request._id,
    fromStatus: request.status,
    toStatus: 'PENDING',
    changedBy: actor.id,
    reason: `Moved to workflow level ${nextLevel.levelNumber}`,
  });

  await createNotification({
    userId: nextApprover._id,
    requestId: request._id,
    type: 'APPROVAL_NEEDED',
    message: `Request "${request.title}" is waiting for your approval (Level ${nextLevel.levelNumber}).`,
  });

  await createAuditLog({
    actorUserId: actor.id,
    entityType: 'REQUEST',
    entityId: request._id,
    action: 'LEVEL_APPROVE',
    meta: { approvedLevel: request.currentLevel, movedToLevel: nextLevel.levelNumber },
    ipAddress,
    userAgent,
  });

  return request;
};

const approveRequest = async ({ requestId, actor, comment, ipAddress, userAgent }) => {
  const request = await Request.findById(requestId);
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }
  if (request.status !== 'PENDING') {
    const error = new Error(`Cannot approve request in ${request.status} state`);
    error.statusCode = 409;
    throw error;
  }

  const approval = await RequestApproval.findOne({
    requestId: request._id,
    levelNumber: request.currentLevel,
    approverId: toObjectId(actor.id),
    action: 'PENDING',
  });
  if (!approval) {
    const error = new Error('No pending approval assigned to this user');
    error.statusCode = 403;
    throw error;
  }

  approval.action = 'APPROVED';
  approval.comment = comment || '';
  approval.actedAt = new Date();
  await approval.save();

  const workflowLevels = await getWorkflowForRequest({
    approvalTypeId: request.approvalTypeId,
    departmentId: request.departmentId,
  });

  const updated = await resolveNextLevel({ request, workflowLevels, actor, ipAddress, userAgent });
  return getRequestById({ requestId: updated._id, actor });
};

const rejectRequest = async ({ requestId, actor, comment, ipAddress, userAgent }) => {
  const request = await Request.findById(requestId);
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }
  if (request.status !== 'PENDING') {
    const error = new Error(`Cannot reject request in ${request.status} state`);
    error.statusCode = 409;
    throw error;
  }

  const approval = await RequestApproval.findOne({
    requestId: request._id,
    levelNumber: request.currentLevel,
    approverId: toObjectId(actor.id),
    action: 'PENDING',
  });
  if (!approval) {
    const error = new Error('No pending approval assigned to this user');
    error.statusCode = 403;
    throw error;
  }

  approval.action = 'REJECTED';
  approval.comment = comment || '';
  approval.actedAt = new Date();
  await approval.save();

  const previousStatus = request.status;
  request.status = 'REJECTED';
  request.finalizedAt = new Date();
  request.currentApproverId = null;
  await request.save();

  await addStatusHistory({
    requestId: request._id,
    fromStatus: previousStatus,
    toStatus: 'REJECTED',
    changedBy: actor.id,
    reason: comment || 'Rejected by approver',
  });

  await createNotification({
    userId: request.requesterId,
    requestId: request._id,
    type: 'REQUEST_REJECTED',
    message: `Your request "${request.title}" was rejected.`,
  });

  await createAuditLog({
    actorUserId: actor.id,
    entityType: 'REQUEST',
    entityId: request._id,
    action: 'REJECT',
    meta: { level: request.currentLevel, comment: comment || '' },
    ipAddress,
    userAgent,
  });

  return getRequestById({ requestId: request._id, actor });
};

const addComment = async ({ requestId, actor, payload, ipAddress, userAgent }) => {
  const request = await Request.findById(requestId).lean();
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }

  const isRequester = String(request.requesterId) === String(actor.id);
  const isApprover = await RequestApproval.exists({
    requestId: toObjectId(requestId),
    approverId: toObjectId(actor.id),
  });
  if (!isRequester && actor.role !== 'admin' && !isApprover) {
    const error = new Error('Not allowed to comment on this request');
    error.statusCode = 403;
    throw error;
  }

  const comment = await Comment.create({
    requestId: toObjectId(requestId),
    userId: toObjectId(actor.id),
    message: payload.message,
    visibility: payload.visibility || 'REQUESTER_VISIBLE',
  });

  if (!isRequester) {
    await createNotification({
      userId: request.requesterId,
      requestId: request._id,
      type: 'COMMENT_ADDED',
      message: `New comment added on request "${request.title}".`,
    });
  }

  await createAuditLog({
    actorUserId: actor.id,
    entityType: 'COMMENT',
    entityId: comment._id,
    action: 'CREATE',
    meta: { requestId: String(request._id), visibility: comment.visibility },
    ipAddress,
    userAgent,
  });

  return comment;
};

const getComments = async ({ requestId, actor }) => {
  await getRequestById({ requestId, actor });
  return Comment.find({ requestId: toObjectId(requestId) })
    .populate('userId', 'name email role')
    .sort({ createdAt: 1 })
    .lean();
};

const addAttachment = async ({ requestId, actor, payload, ipAddress, userAgent }) => {
  const request = await Request.findById(requestId).lean();
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }

  const isRequester = String(request.requesterId) === String(actor.id);
  if (!isRequester && actor.role !== 'admin') {
    const error = new Error('Only requester/admin can add attachments');
    error.statusCode = 403;
    throw error;
  }

  const attachment = await Attachment.create({
    requestId: request._id,
    uploadedBy: toObjectId(actor.id),
    fileName: payload.fileName,
    fileUrl: payload.fileUrl,
    mimeType: payload.mimeType || '',
    fileSize: Number(payload.fileSize || 0),
  });

  await createAuditLog({
    actorUserId: actor.id,
    entityType: 'ATTACHMENT',
    entityId: attachment._id,
    action: 'CREATE',
    meta: { requestId: String(request._id), fileName: attachment.fileName },
    ipAddress,
    userAgent,
  });

  return attachment;
};

const getDashboardSummary = async ({ actor }) => {
  const isEmployee = actor.role === 'employee';
  const baseFilter = isEmployee ? { requesterId: toObjectId(actor.id) } : {};

  const [total, pending, approved, rejected] = await Promise.all([
    Request.countDocuments(baseFilter),
    Request.countDocuments({ ...baseFilter, status: 'PENDING' }),
    Request.countDocuments({ ...baseFilter, status: 'APPROVED' }),
    Request.countDocuments({ ...baseFilter, status: 'REJECTED' }),
  ]);

  const myPendingApprovals = ['approver', 'manager', 'admin'].includes(actor.role)
    ? await RequestApproval.countDocuments({
        approverId: toObjectId(actor.id),
        action: 'PENDING',
      })
    : 0;

  return {
    total,
    pending,
    approved,
    rejected,
    myPendingApprovals,
  };
};

const getPendingApprovals = async ({ actor }) => {
  return RequestApproval.find({
    approverId: toObjectId(actor.id),
    action: 'PENDING',
  })
    .populate({
      path: 'requestId',
      populate: [
        { path: 'requesterId', select: 'name email employeeId role' },
        { path: 'departmentId', select: 'name code' },
        { path: 'approvalTypeId', select: 'name' },
      ],
    })
    .sort({ createdAt: 1 })
    .lean();
};

module.exports = {
  createRequest,
  getRequests,
  getMyRequests,
  getRequestById,
  approveRequest,
  rejectRequest,
  addComment,
  getComments,
  addAttachment,
  getDashboardSummary,
  getPendingApprovals,
};

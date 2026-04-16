const crypto = require('crypto');
const {
  createApprovalConfirmation,
  consumeApprovalConfirmation,
  createRequest: createRequestInStore,
  findDelegationByDelegatorId,
  findPendingRequestsForManager,
  findRequestById,
  findRequestsByUserId,
  listRequests,
  updateRequest,
  users,
  findUserById,
  setDelegation,
  removeDelegation,
} = require('../data/mockStore');
const notificationService = require('./notification.service');

const HIGH_AMOUNT_THRESHOLD = 10000;
const DEFAULT_SLA_HOURS = 48;

const buildHash = ({ requestId, status, byUser, role, comment, timestamp, prevHash }) =>
  crypto
    .createHash('sha256')
    .update([requestId, status, byUser, role, comment, timestamp, prevHash || ''].join('|'))
    .digest('hex');

const derivePriority = ({ amount, department }) => {
  if (Number(amount) >= 20000) return 'high';
  if (department === 'Finance' && Number(amount) >= 10000) return 'high';
  if (Number(amount) >= 5000) return 'medium';
  return 'low';
};

const toSlaProgress = (request) => {
  if (!request.dueAt) return 0;
  const total = DEFAULT_SLA_HOURS * 60 * 60 * 1000;
  const elapsed = Date.now() - new Date(request.createdAt).getTime();
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
};

const getApprovalProbability = (request) => {
  let score = 0.55;
  if (request.priority === 'high') score -= 0.18;
  if (Number(request.amount) < 5000) score += 0.18;
  if (request.department === 'Finance') score -= 0.08;
  if (request.urgency === 'urgent') score -= 0.05;
  return Math.max(0.05, Math.min(0.95, Number(score.toFixed(2))));
};

const getDelayPredictionDays = (request) => {
  let days = 1.8;
  if (request.priority === 'high') days += 0.9;
  if (request.department === 'Finance') days += 0.5;
  if (request.urgency === 'urgent') days -= 0.3;
  return Number(Math.max(0.6, days).toFixed(1));
};

const detectDuplicate = ({ title, requesterId, amount, department }) => {
  const query = title.trim().toLowerCase();
  return listRequests().find(
    (item) =>
      item.requesterId === requesterId &&
      item.department === department &&
      item.title.trim().toLowerCase() === query &&
      Math.abs(Number(item.amount || 0) - Number(amount || 0)) <= 100 &&
      ['pending', 'admin_review'].includes(item.status)
  );
};

const canActAsManager = ({ actor, request }) => {
  if (actor.role === 'admin') return true;
  if (actor.role !== 'manager') return false;
  if (!request.assignedManagerId) return true;
  if (request.assignedManagerId === actor.id) return true;
  const delegation = findDelegationByDelegatorId(request.assignedManagerId);
  if (!delegation) return false;
  if (delegation.delegateId !== actor.id) return false;
  return new Date(delegation.activeUntil).getTime() > Date.now();
};

const pushTimeline = (request, entry) => {
  const timestamp = new Date().toISOString();
  const prevHash = request.timeline.length ? request.timeline[request.timeline.length - 1].hash : '';
  request.timeline.push({
    status: entry.status,
    byUser: entry.byUser,
    role: entry.role,
    actorName: entry.actorName || '',
    comment: entry.comment || '',
    timestamp,
    hash: buildHash({
      requestId: request.id,
      status: entry.status,
      byUser: entry.byUser,
      role: entry.role,
      comment: entry.comment || '',
      timestamp,
      prevHash,
    }),
  });
};

const pushAuditTrail = (request, entry) => {
  request.auditTrail = request.auditTrail || [];
  request.auditTrail.push({
    action: entry.action,
    actorId: entry.actorId,
    actorName: entry.actorName || '',
    actorRole: entry.actorRole,
    comment: entry.comment || '',
    timestamp: new Date().toISOString(),
  });
};

const withComputedFields = (request) => ({
  ...request,
  slaProgress: toSlaProgress(request),
  isOverdue: request.dueAt ? new Date(request.dueAt).getTime() < Date.now() : false,
  approvalProbability: getApprovalProbability(request),
  delayPredictionDays: getDelayPredictionDays(request),
});

const createRequest = ({ body, user }) => {
  const duplicate = detectDuplicate({
    title: body.title,
    requesterId: user.id,
    amount: body.amount,
    department: body.department,
  });
  const autoPriority = derivePriority({
    amount: body.amount,
    department: body.department,
  });

  const defaultManager = users.find((item) => item.role === 'manager');
  const request = createRequestInStore({
    ...body,
    priority: body.priority || autoPriority,
    requesterId: user.id,
    requesterName: user.name,
    requesterDepartment: user.department || body.department,
    requesterRole: user.role,
    assignedManagerId: defaultManager?.id || null,
    duplicateHint: duplicate
      ? {
          duplicateOfRequestId: duplicate.id,
          reason: 'Potential duplicate detected by title/department/amount',
        }
      : null,
  });

  notificationService.createInfoNotification({
    userId: user.id,
    title: 'Request Submitted - Infosys Approval System',
    message: `Your request '${request.title}' has entered the approval queue.`,
  });
  notificationService.sendRequestSubmissionEmail({
    approverId: request.assignedManagerId || null,
    requesterName: request.requesterName,
    requestId: request.id,
    requestTitle: request.title,
    requestDescription: request.description,
    department: request.department,
    priority: request.priority,
    submittedAt: request.createdAt,
  });

  if (duplicate) {
    notificationService.createInfoNotification({
      userId: user.id,
      title: 'Duplicate Warning - Infosys Approval System',
      message: `Request '${request.title}' appears similar to '${duplicate.title}'. Please review before submitting again.`,
    });
  }

  return withComputedFields(request);
};

const getMyRequests = ({ userId, filters = {} }) => {
  let rows = findRequestsByUserId(userId);
  if (filters.search) {
    const query = filters.search.toLowerCase();
    rows = rows.filter((item) => item.title.toLowerCase().includes(query));
  }
  if (filters.status) rows = rows.filter((item) => item.status === filters.status);
  if (filters.priority) rows = rows.filter((item) => item.priority === filters.priority);
  if (filters.fromDate) rows = rows.filter((item) => new Date(item.createdAt) >= new Date(filters.fromDate));
  if (filters.toDate)
    rows = rows.filter((item) => new Date(item.createdAt) <= new Date(`${filters.toDate}T23:59:59.999Z`));
  return rows.map(withComputedFields);
};

const getAllRequestsByRole = ({ user }) => {
  if (user.role === 'admin') return listRequests().map(withComputedFields);
  if (user.role === 'manager')
    return findPendingRequestsForManager()
      .filter((item) => canActAsManager({ actor: user, request: item }))
      .map(withComputedFields);
  return findRequestsByUserId(user.id).map(withComputedFields);
};

const getRequestById = ({ requestId, user }) => {
  const request = findRequestById(requestId);
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }

  const canView = request.requesterId === user.id || ['manager', 'admin'].includes(user.role);
  if (!canView) {
    const error = new Error('You are not allowed to view this request');
    error.statusCode = 403;
    throw error;
  }

  return withComputedFields(request);
};

const withdrawRequest = ({ requestId, user, comment }) => {
  const request = findRequestById(requestId);
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }
  if (request.requesterId !== user.id) {
    const error = new Error('Only owner can withdraw this request');
    error.statusCode = 403;
    throw error;
  }
  if (['approved', 'rejected', 'withdrawn'].includes(request.status)) {
    const error = new Error(`Cannot withdraw request in '${request.status}' state`);
    error.statusCode = 409;
    throw error;
  }

  const updated = updateRequest(requestId, (target) => {
    target.status = 'withdrawn';
    pushTimeline(target, {
      status: 'withdrawn',
      byUser: user.id,
      role: user.role,
      actorName: user.name,
      comment: comment || 'Withdrawn by requester',
    });
    pushAuditTrail(target, {
      action: 'withdrawn',
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      comment: comment || 'Withdrawn by requester',
    });
  });

  notificationService.createInfoNotification({
    userId: updated.requesterId,
    title: 'Request Withdrawn - Infosys Approval System',
    message: `Your request '${updated.title}' has been withdrawn.`,
  });

  return withComputedFields(updated);
};

const managerApprove = ({ requestId, user, comment }) => {
  const request = findRequestById(requestId);
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }
  if (!canActAsManager({ actor: user, request })) {
    const error = new Error('You are not allowed to act as manager for this request');
    error.statusCode = 403;
    throw error;
  }
  if (request.status !== 'pending') {
    const error = new Error(`Manager can only review pending requests. Current: ${request.status}`);
    error.statusCode = 409;
    throw error;
  }

  const requiresAdmin = Number(request.amount || 0) > HIGH_AMOUNT_THRESHOLD;
  const updated = updateRequest(requestId, (target) => {
    pushTimeline(target, {
      status: 'manager_review',
      byUser: user.id,
      role: user.role,
      actorName: user.name,
      comment: comment || 'Manager reviewed request',
    });
    pushAuditTrail(target, {
      action: 'manager_approved',
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      comment: comment || 'Manager approved request',
    });

    if (requiresAdmin) {
      target.status = 'admin_review';
      pushTimeline(target, {
        status: 'admin_review',
        byUser: user.id,
        role: user.role,
        actorName: user.name,
        comment: 'Escalated to admin due to amount threshold',
      });
    } else {
      target.status = 'approved';
      pushTimeline(target, {
        status: 'approved',
        byUser: user.id,
        role: user.role,
        actorName: user.name,
        comment: 'Approved by manager (within manager threshold)',
      });
      pushAuditTrail(target, {
        action: 'final_approved_by_manager',
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        comment: 'Final approval (amount under threshold)',
      });
    }
  });

  if (updated.status === 'approved') {
    notificationService.createApprovalNotification({
      userId: updated.requesterId,
      requestTitle: updated.title,
      requestId: updated.id,
      role: 'Manager',
      comments: comment || '',
      nextStep: 'Request completed',
    });
    notificationService.sendApprovalStageEmail({
      recipientUserId: updated.requesterId,
      requestId: updated.id,
      approverName: user.name,
      approvalStage: 'Manager Approval',
      comments: comment || '',
      nextStep: 'Request completed',
    });
  } else {
    notificationService.createInfoNotification({
      userId: updated.requesterId,
      title: 'Request Escalated - Infosys Approval System',
      message: `Your request '${updated.title}' passed manager review and is now under admin review.`,
    });
    const admin = users.find((item) => item.role === 'admin');
    if (admin) {
      notificationService.sendApprovalStageEmail({
        recipientUserId: admin.id,
        requestId: updated.id,
        approverName: user.name,
        approvalStage: 'Manager Approval',
        comments: comment || '',
        nextStep: 'Admin review required',
      });
    }
  }

  return withComputedFields(updated);
};

const managerReject = ({ requestId, user, comment }) => {
  const request = findRequestById(requestId);
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }
  if (!canActAsManager({ actor: user, request })) {
    const error = new Error('You are not allowed to act as manager for this request');
    error.statusCode = 403;
    throw error;
  }
  if (request.status !== 'pending') {
    const error = new Error(`Manager can only reject pending requests. Current: ${request.status}`);
    error.statusCode = 409;
    throw error;
  }

  const updated = updateRequest(requestId, (target) => {
    target.status = 'rejected';
    pushTimeline(target, {
      status: 'rejected',
      byUser: user.id,
      role: user.role,
      actorName: user.name,
      comment: comment || 'Rejected by manager',
    });
    pushAuditTrail(target, {
      action: 'manager_rejected',
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      comment: comment || 'Rejected by manager',
    });
  });

  notificationService.createRejectionNotification({
    userId: updated.requesterId,
    requestTitle: updated.title,
    requestId: updated.id,
    rejectorName: user.name,
    reason: comment || 'Rejected by manager',
  });
  notificationService.sendRejectionStageEmail({
    recipientUserId: updated.requesterId,
    requestId: updated.id,
    rejectorName: user.name,
    reason: comment || 'Rejected by manager',
  });

  return withComputedFields(updated);
};

const createHighAmountApprovalConfirmation = ({ requestId, user }) => {
  const request = findRequestById(requestId);
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }
  if (user.role !== 'admin') {
    const error = new Error('Only admin can request approval confirmation token');
    error.statusCode = 403;
    throw error;
  }
  if (request.status !== 'admin_review') {
    const error = new Error('Confirmation token is only available for admin_review requests');
    error.statusCode = 409;
    throw error;
  }
  if (Number(request.amount || 0) <= HIGH_AMOUNT_THRESHOLD) {
    return { required: false, token: null };
  }

  const token = createApprovalConfirmation({
    requestId: request.id,
    approverId: user.id,
  });
  return { required: true, token: token.token, expiresAt: token.expiresAt };
};

const adminApprove = ({ requestId, user, comment, confirmationToken }) => {
  const request = findRequestById(requestId);
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }
  if (request.status !== 'admin_review') {
    const error = new Error(`Admin can only approve requests in admin_review. Current: ${request.status}`);
    error.statusCode = 409;
    throw error;
  }

  const needsConfirmation = Number(request.amount || 0) > HIGH_AMOUNT_THRESHOLD;
  if (needsConfirmation) {
    const consumed = consumeApprovalConfirmation({
      requestId: request.id,
      approverId: user.id,
      token: confirmationToken,
    });
    if (!consumed) {
      const error = new Error('High-amount approval requires a valid confirmation token');
      error.statusCode = 428;
      throw error;
    }
  }

  const updated = updateRequest(requestId, (target) => {
    target.status = 'approved';
    pushTimeline(target, {
      status: 'approved',
      byUser: user.id,
      role: user.role,
      actorName: user.name,
      comment: comment || 'Approved by admin',
    });
    pushAuditTrail(target, {
      action: 'admin_approved',
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      comment: comment || 'Approved by admin',
    });
  });

  notificationService.createApprovalNotification({
    userId: updated.requesterId,
    requestTitle: updated.title,
    requestId: updated.id,
    role: 'Admin',
    comments: comment || '',
    nextStep: 'Request completed',
  });
  notificationService.sendApprovalStageEmail({
    recipientUserId: updated.requesterId,
    requestId: updated.id,
    approverName: user.name,
    approvalStage: 'Admin Approval',
    comments: comment || '',
    nextStep: 'Request completed',
  });

  return withComputedFields(updated);
};

const adminReject = ({ requestId, user, comment }) => {
  const request = findRequestById(requestId);
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }
  if (request.status !== 'admin_review') {
    const error = new Error(`Admin can only reject requests in admin_review. Current: ${request.status}`);
    error.statusCode = 409;
    throw error;
  }

  const updated = updateRequest(requestId, (target) => {
    target.status = 'rejected';
    pushTimeline(target, {
      status: 'rejected',
      byUser: user.id,
      role: user.role,
      actorName: user.name,
      comment: comment || 'Rejected by admin',
    });
    pushAuditTrail(target, {
      action: 'admin_rejected',
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      comment: comment || 'Rejected by admin',
    });
  });

  notificationService.createRejectionNotification({
    userId: updated.requesterId,
    requestTitle: updated.title,
    requestId: updated.id,
    rejectorName: user.name,
    reason: comment || 'Rejected by admin',
  });
  notificationService.sendRejectionStageEmail({
    recipientUserId: updated.requesterId,
    requestId: updated.id,
    rejectorName: user.name,
    reason: comment || 'Rejected by admin',
  });

  return withComputedFields(updated);
};

const extractMentionedUsers = (comment) => {
  if (!comment) return [];
  const mentions = [...comment.matchAll(/@([a-zA-Z0-9._-]+)/g)].map((match) => match[1].toLowerCase());
  if (!mentions.length) return [];
  return users.filter(
    (user) =>
      mentions.includes(user.name.toLowerCase().replace(/\s+/g, '.')) || mentions.includes(user.email.toLowerCase())
  );
};

const addComment = ({ requestId, user, comment }) => {
  const request = findRequestById(requestId);
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }

  const canComment = request.requesterId === user.id || ['manager', 'admin'].includes(user.role);
  if (!canComment) {
    const error = new Error('You are not allowed to comment on this request');
    error.statusCode = 403;
    throw error;
  }

  const updated = updateRequest(requestId, (target) => {
    pushTimeline(target, {
      status: target.status,
      byUser: user.id,
      role: user.role,
      actorName: user.name,
      comment,
    });
    pushAuditTrail(target, {
      action: 'comment_added',
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      comment,
    });
  });

  if (updated.requesterId !== user.id) {
    notificationService.createInfoNotification({
      userId: updated.requesterId,
      title: 'Comment Added - Infosys Approval System',
      message: `A new comment was added on '${updated.title}'. View details.`,
    });
    if (['manager', 'admin', 'approver'].includes(user.role)) {
      notificationService.sendModificationNeededEmail({
        recipientUserId: updated.requesterId,
        requestId: updated.id,
        reviewerName: user.name,
        comments: comment || 'Please provide additional details for this request.',
      });
    }
  }

  const mentionedUsers = extractMentionedUsers(comment);
  mentionedUsers.forEach((mentionedUser) => {
    if (mentionedUser.id === user.id) return;
    notificationService.createInfoNotification({
      userId: mentionedUser.id,
      title: 'Mention Alert - Infosys Approval System',
      message: `${user.name} mentioned you in request '${updated.title}'.`,
    });
  });

  return withComputedFields(updated);
};

const getManagerQueue = ({ filters = {}, user }) => {
  let rows = findPendingRequestsForManager()
    .filter((item) => canActAsManager({ actor: user, request: item }))
    .map(withComputedFields);
  if (filters.priority) rows = rows.filter((item) => item.priority === filters.priority);
  if (filters.urgency) rows = rows.filter((item) => item.urgency === filters.urgency);

  const managerReviewed = listRequests().filter((item) =>
    (item.auditTrail || []).some((entry) => entry.action === 'manager_approved' || entry.action === 'manager_rejected')
  );
  const managerReviewMs = managerReviewed.reduce((sum, item) => {
    const firstManagerAction = (item.auditTrail || []).find(
      (entry) => entry.action === 'manager_approved' || entry.action === 'manager_rejected'
    );
    if (!firstManagerAction) return sum;
    return sum + (new Date(firstManagerAction.timestamp) - new Date(item.createdAt));
  }, 0);

  const avgManagerReviewHours = managerReviewed.length
    ? Number((managerReviewMs / managerReviewed.length / (1000 * 60 * 60)).toFixed(2))
    : 0;

  return {
    items: rows,
    metrics: {
      pendingApprovals: rows.length,
      averageManagerApprovalTimeHours: avgManagerReviewHours,
      highestPriorityItems: rows.filter((item) => item.priority === 'high').length,
      managerEfficiencyScore: Number(Math.max(0, 100 - avgManagerReviewHours * 8).toFixed(1)),
    },
  };
};

const bulkManagerAction = ({ requestIds, user, action, comment }) => {
  const results = [];
  requestIds.forEach((requestId) => {
    try {
      if (action === 'approve') results.push(managerApprove({ requestId, user, comment }));
      if (action === 'reject') results.push(managerReject({ requestId, user, comment }));
    } catch (error) {
      results.push({
        requestId,
        error: error.message,
      });
    }
  });
  return results;
};

const runSlaEscalation = () => {
  const now = Date.now();
  const escalated = [];
  listRequests().forEach((request) => {
    if (request.status !== 'pending') return;
    if (!request.dueAt || new Date(request.dueAt).getTime() > now) return;
    const systemActor = {
      id: 'sys',
      role: 'system',
      name: 'Infosys Approval System Auto Escalation',
    };
    updateRequest(request.id, (target) => {
      target.status = 'admin_review';
      pushTimeline(target, {
        status: 'admin_review',
        byUser: systemActor.id,
        role: systemActor.role,
        actorName: systemActor.name,
        comment: 'Auto-escalated due to SLA breach',
      });
      pushAuditTrail(target, {
        action: 'sla_auto_escalation',
        actorId: systemActor.id,
        actorName: systemActor.name,
        actorRole: systemActor.role,
        comment: 'Auto-escalated due to SLA breach',
      });
    });
    escalated.push(request.id);
    notificationService.createInfoNotification({
      userId: request.requesterId,
      title: 'SLA Escalation - Infosys Approval System',
      message: `Your request '${request.title}' was escalated due to SLA timeout.`,
    });
  });
  return { escalatedCount: escalated.length, requestIds: escalated };
};

const setProxyApprover = ({ delegatorId, delegateId, activeUntil, user }) => {
  if (!['manager', 'admin'].includes(user.role)) {
    const error = new Error('Only managers/admins can assign proxy approvers');
    error.statusCode = 403;
    throw error;
  }
  const delegator = findUserById(delegatorId);
  const delegate = findUserById(delegateId);
  if (!delegator || !delegate) {
    const error = new Error('Delegator or delegate user not found');
    error.statusCode = 404;
    throw error;
  }
  if (!['manager', 'admin'].includes(delegate.role)) {
    const error = new Error('Delegate must be manager or admin');
    error.statusCode = 409;
    throw error;
  }
  return setDelegation({ delegatorId, delegateId, activeUntil });
};

const clearProxyApprover = ({ delegatorId, user }) => {
  if (!['manager', 'admin'].includes(user.role)) {
    const error = new Error('Only managers/admins can clear proxy approvers');
    error.statusCode = 403;
    throw error;
  }
  return removeDelegation(delegatorId);
};

module.exports = {
  createRequest,
  getMyRequests,
  getAllRequestsByRole,
  getRequestById,
  withdrawRequest,
  managerApprove,
  managerReject,
  createHighAmountApprovalConfirmation,
  adminApprove,
  adminReject,
  addComment,
  getManagerQueue,
  bulkManagerAction,
  runSlaEscalation,
  setProxyApprover,
  clearProxyApprover,
};

const mongoose = require('mongoose');
const Request = require('../models/Request');
const User = require('../models/User');
const Department = require('../models/Department');
const ApprovalType = require('../models/ApprovalType');
const Notification = require('../models/Notification');
const ApprovalLog = require('../models/ApprovalLog');
const Escalation = require('../models/Escalation');
const AIPrediction = require('../models/AIPrediction');
const legacyRequestService = require('./request.service');
const logger = require('../utils/logger');

const PENDING_STATUSES = ['PENDING', 'ESCALATED'];
const DECIDED_STATUSES = ['APPROVED', 'REJECTED'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const avg = (values) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};
const toHours = (start, end) => {
  const from = new Date(start || 0).getTime();
  const to = new Date(end || 0).getTime();
  if (!from || !to || to <= from) return 0;
  return (to - from) / (1000 * 60 * 60);
};

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizePriority = (priority = '') => {
  const value = String(priority || '').trim().toLowerCase();
  if (value === 'urgent') return 'critical';
  if (['low', 'medium', 'high', 'critical'].includes(value)) return value;
  return 'medium';
};

const toRiskLevel = (riskScore = 0) => {
  if (riskScore >= 70) return 'High';
  if (riskScore >= 40) return 'Medium';
  return 'Low';
};

const departmentDelayPenalty = (hours = 0) => {
  if (hours >= 96) return 18;
  if (hours >= 72) return 13;
  if (hours >= 48) return 8;
  if (hours >= 30) return 4;
  return 0;
};

const buildDepartmentCode = (name) => {
  const words = String(name || 'General').split(/\s+/).filter(Boolean);
  const compact = words.map((part) => part[0]).join('').toUpperCase();
  return (compact || String(name || 'GEN').slice(0, 3)).slice(0, 6);
};

const generateRequestNumber = async () => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `AIREQ-${stamp}`;
  const count = await Request.countDocuments({
    requestNumber: { $regex: `^${prefix}-` },
  });
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
};

const extractAmount = (payload = {}) => {
  const amount = Number(payload.amount || 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const sanitizeAttachmentNames = (attachments = []) =>
  (Array.isArray(attachments) ? attachments : [])
    .map((item) => {
      if (!item) return '';
      if (typeof item === 'string') return item;
      if (typeof item === 'object') {
        return item.fileName || item.name || '';
      }
      return '';
    })
    .map((item) => String(item).trim())
    .filter(Boolean);

const summarizeReason = (description = '') => {
  const clean = String(description || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return 'general business requirement';
  const words = clean.split(' ').slice(0, 10);
  return words.join(' ');
};

const buildRequestSummary = ({ title, description, type }) => {
  const titleText = String(title || '').trim();
  const normalizedType = String(type || '').trim() || 'General';
  const durationMatch = `${titleText} ${description || ''}`.match(
    /(\d+)\s*(day|days|hour|hours|week|weeks)/i
  );
  const duration = durationMatch ? `${durationMatch[1]} ${durationMatch[2].toLowerCase()}` : '';

  const reason = summarizeReason(description);
  if (duration) {
    return `${normalizedType} request for ${duration} due to ${reason}.`;
  }
  if (titleText) {
    return `${normalizedType} request: ${titleText}. Reason: ${reason}.`;
  }
  return `${normalizedType} request generated for ${reason}.`;
};

const getRequiredDocuments = ({ title, description, type, amount, priority }) => {
  const text = `${title || ''} ${description || ''} ${type || ''}`.toLowerCase();
  const docs = new Set(['Business justification note']);

  if (text.includes('leave')) docs.add('Leave plan document');
  if (text.includes('medical')) docs.add('Medical certificate');
  if (text.includes('travel')) docs.add('Travel itinerary');
  if (text.includes('purchase') || text.includes('procurement')) docs.add('Vendor quotation');
  if (text.includes('expense') || amount >= 5000) docs.add('Invoice or cost sheet');
  if (amount >= 10000 || priority === 'critical') docs.add('Budget owner approval note');
  if (amount >= 20000) docs.add('Risk and compliance assessment');

  return [...docs];
};

const resolveMissingDocuments = ({ requiredDocuments, attachments }) => {
  const normalizedAttachments = sanitizeAttachmentNames(attachments).map((name) => name.toLowerCase());
  return requiredDocuments.filter((documentName) => {
    const tokens = String(documentName)
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 3);
    return !tokens.some((token) => normalizedAttachments.some((name) => name.includes(token)));
  });
};

const ensureDepartment = async (name = 'General') => {
  const normalizedName = String(name || 'General').trim() || 'General';
  let department = await Department.findOne({
    name: { $regex: `^${escapeRegex(normalizedName)}$`, $options: 'i' },
  });

  if (!department) {
    const baseCode = buildDepartmentCode(normalizedName);
    let finalCode = baseCode;
    let suffix = 1;
    while (await Department.exists({ code: finalCode })) {
      suffix += 1;
      finalCode = `${baseCode}${suffix}`.slice(0, 8);
    }
    department = await Department.create({
      name: normalizedName,
      code: finalCode,
      isActive: true,
    });
  }
  return department;
};

const ensureApprovalType = async ({ rawType = '', departmentId = null }) => {
  const normalizedType = String(rawType || 'GENERAL_REQUEST')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  let type = await ApprovalType.findOne({
    name: normalizedType,
    departmentId: departmentId || null,
  });

  if (!type) {
    type = await ApprovalType.findOne({
      name: normalizedType,
      departmentId: null,
    });
  }

  if (!type) {
    type = await ApprovalType.create({
      name: normalizedType,
      description: `${normalizedType.replace(/_/g, ' ')} workflow`,
      departmentId: departmentId || null,
      isActive: true,
    });
  }

  return type;
};

const getApproverPerformanceMap = async () => {
  const rows = await ApprovalLog.aggregate([
    {
      $match: {
        action: { $in: ['APPROVED', 'REJECTED'] },
        approverId: { $ne: null },
      },
    },
    {
      $group: {
        _id: '$approverId',
        avgTimeTaken: { $avg: '$timeTaken' },
        handled: { $sum: 1 },
      },
    },
  ]);

  const map = new Map();
  rows.forEach((row) => {
    map.set(String(row._id), {
      avgTimeTaken: Number(row.avgTimeTaken || 0),
      handled: Number(row.handled || 0),
    });
  });
  return map;
};

const getApproverLoadMap = async () => {
  const rows = await Request.aggregate([
    {
      $match: {
        status: { $in: PENDING_STATUSES },
        currentApprover: { $ne: null },
      },
    },
    {
      $group: {
        _id: '$currentApprover',
        pendingCount: { $sum: 1 },
      },
    },
  ]);

  const map = new Map();
  rows.forEach((row) => {
    map.set(String(row._id), Number(row.pendingCount || 0));
  });
  return map;
};

const getDepartmentHistory = async () => {
  const rows = await Request.find({
    status: { $in: DECIDED_STATUSES },
  })
    .select('department status submittedAt finalizedAt createdAt updatedAt')
    .lean();

  const byDepartment = {};
  rows.forEach((row) => {
    const department = row.department || 'General';
    if (!byDepartment[department]) {
      byDepartment[department] = { durations: [], total: 0, rejected: 0 };
    }
    const duration = toHours(row.submittedAt || row.createdAt, row.finalizedAt || row.updatedAt);
    if (duration > 0) byDepartment[department].durations.push(duration);
    byDepartment[department].total += 1;
    if (String(row.status || '').toUpperCase() === 'REJECTED') {
      byDepartment[department].rejected += 1;
    }
  });

  return byDepartment;
};

const getCandidateApprovers = async ({ department = 'General' }) => {
  const normalizedDepartment = String(department || 'General').trim();
  const users = await User.find({
    role: { $in: ['manager', 'approver', 'admin'] },
    isActive: { $ne: false },
    $or: [{ department: normalizedDepartment }, { role: 'admin' }],
  }).lean();

  if (users.length) return users;
  return User.find({
    role: { $in: ['manager', 'approver', 'admin'] },
    isActive: { $ne: false },
  }).lean();
};

const scoreApproverCandidates = ({ approvers, performanceMap, loadMap, department }) =>
  approvers
    .map((user) => {
      const perf = performanceMap.get(String(user._id)) || { avgTimeTaken: 36, handled: 0 };
      const pendingCount = loadMap.get(String(user._id)) || 0;
      const departmentAffinity =
        String(user.department || '').toLowerCase() === String(department || '').toLowerCase()
          ? 1
          : 0;
      const score = perf.avgTimeTaken * 1.3 + pendingCount * 3.2 - departmentAffinity * 5;
      return {
        user,
        pendingCount,
        avgTimeTaken: Number(perf.avgTimeTaken || 36),
        handled: Number(perf.handled || 0),
        score: Number(score.toFixed(2)),
      };
    })
    .sort((a, b) => a.score - b.score || b.handled - a.handled);

const buildPrediction = async ({ payload, selectedApprover, candidateApprovers }) => {
  const amount = extractAmount(payload);
  const priority = normalizePriority(payload.priority);
  const requiredDocuments = getRequiredDocuments({
    title: payload.title,
    description: payload.description,
    type: payload.type,
    amount,
    priority,
  });
  const missingDocuments = resolveMissingDocuments({
    requiredDocuments,
    attachments: payload.attachments,
  });

  const departmentHistory = await getDepartmentHistory();
  const departmentKey = payload.department || 'General';
  const history = departmentHistory[departmentKey] || { durations: [], total: 0, rejected: 0 };

  const departmentAvgHours = avg(history.durations) || 30;
  const departmentRejectRate = history.total ? history.rejected / history.total : 0.2;
  const approverLoadPenalty = Number(selectedApprover?.pendingCount || 0) * 2.4;
  const priorityPenalty =
    priority === 'critical' ? 16 : priority === 'high' ? 9 : priority === 'low' ? -4 : 2;
  const docsPenalty = missingDocuments.length * 4.5;
  const amountPenalty = amount >= 20000 ? 18 : amount >= 10000 ? 10 : amount >= 5000 ? 5 : 1.5;
  const rejectionPenalty = departmentRejectRate * 24;

  const predictedDelayHours = Number(
    clamp(
      departmentAvgHours + approverLoadPenalty + priorityPenalty + docsPenalty + amountPenalty + rejectionPenalty,
      6,
      240
    ).toFixed(1)
  );
  const predictedCompletionDate = new Date(Date.now() + predictedDelayHours * 60 * 60 * 1000);

  let riskScore = 18;
  riskScore += missingDocuments.length * 13;
  riskScore += String(payload.description || '').trim().length < 35 ? 14 : 0;
  riskScore += amount >= 20000 ? 20 : amount >= 10000 ? 12 : amount >= 5000 ? 6 : 0;
  riskScore += priority === 'critical' ? 12 : priority === 'high' ? 8 : 0;
  riskScore += Number(selectedApprover?.pendingCount || 0) * 3.2;
  riskScore += departmentDelayPenalty(departmentAvgHours);
  riskScore += rejectionPenalty;
  riskScore -= sanitizeAttachmentNames(payload.attachments).length >= 3 ? 6 : 0;
  riskScore = Number(clamp(riskScore, 5, 99).toFixed(1));

  const riskLevel = toRiskLevel(riskScore);
  const aiSummary = buildRequestSummary({
    title: payload.title,
    description: payload.description,
    type: payload.type || 'General',
  });

  const bottleneckWarnings = [];
  if (departmentAvgHours >= 48) {
    bottleneckWarnings.push(
      `${departmentKey} department is trending slow (${departmentAvgHours.toFixed(1)}h average completion).`
    );
  }
  if (Number(selectedApprover?.pendingCount || 0) >= 5) {
    bottleneckWarnings.push(
      `${selectedApprover.user?.name || 'Current approver'} has high queue load (${selectedApprover.pendingCount} open requests).`
    );
  }
  if (departmentRejectRate >= 0.35) {
    bottleneckWarnings.push(
      `Historical rejection rate for ${departmentKey} is elevated (${Math.round(departmentRejectRate * 100)}%).`
    );
  }

  const smartRouteRecommendation = candidateApprovers
    .slice(0, 3)
    .map(
      (item) =>
        `${item.user.name} (${item.user.role}) - avg ${Number(item.avgTimeTaken || 0).toFixed(1)}h, queue ${item.pendingCount}`
    );

  const warningMessage =
    missingDocuments.length > 0 && riskLevel === 'High'
      ? `This request has high chance of rejection because required document is missing: ${missingDocuments.join(
          ', '
        )}.`
      : '';

  return {
    riskScore,
    riskLevel,
    predictedDelayHours,
    predictedCompletionDate,
    aiSummary,
    requiredDocuments,
    missingDocuments,
    smartRouteRecommendation,
    bottleneckWarnings,
    warningMessage,
  };
};

const toApiRequest = (request, prediction = null) => ({
  id: String(request._id),
  requestNumber: request.requestNumber,
  title: request.title,
  description: request.description || '',
  type: request.type || 'General',
  department: request.department || 'General',
  priority: request.priority || 'medium',
  attachments: request.attachments || [],
  submittedBy: request.submittedBy || request.requesterId || null,
  status: request.status || 'PENDING',
  currentApprover: request.currentApprover || request.currentApproverId || null,
  createdAt: request.createdAt,
  aiRiskScore: Number(request.aiRiskScore || prediction?.riskScore || 0),
  riskLevel: request.riskLevel || prediction?.riskLevel || 'Low',
  predictedDelay: Number(request.predictedDelay || prediction?.predictedDelayHours || 0),
  predictedDelayHours: Number(request.predictedDelayHours || prediction?.predictedDelayHours || 0),
  predictedCompletionDate:
    request.predictedCompletionDate || prediction?.predictedCompletionDate || null,
  aiSummary: request.aiSummary || prediction?.aiSummary || '',
  missingDocuments: request.missingDocuments || prediction?.missingDocuments || [],
  requiredDocuments: request.requiredDocuments || prediction?.requiredDocuments || [],
  smartRouteRecommendation:
    request.routeRecommendations || prediction?.smartRouteRecommendation || [],
  bottleneckWarnings: request.bottleneckWarnings || prediction?.bottleneckWarnings || [],
  warningMessage: prediction?.warningMessage || '',
  escalationCount: Number(request.escalationCount || 0),
  lastEscalatedAt: request.lastEscalatedAt || null,
  legacyRequestId: request.legacyRequestId || '',
});

const syncIntoLegacyWorkflow = ({ payload, actor }) => {
  try {
    const legacyRequest = legacyRequestService.createRequest({
      body: {
        title: payload.title,
        type: payload.type || 'General',
        department: payload.department || actor.department || 'General',
        amount: extractAmount(payload),
        priority: normalizePriority(payload.priority),
        urgency: payload.urgency || 'normal',
        description: payload.description || '',
        attachments: sanitizeAttachmentNames(payload.attachments),
      },
      user: {
        id: actor.id,
        role: actor.role || 'employee',
        name: actor.name,
        department: payload.department || actor.department || 'General',
      },
    });
    return legacyRequest?.id || '';
  } catch (error) {
    logger.warn('Legacy workflow sync skipped', { message: error.message });
    return '';
  }
};

const createRequestWithPrediction = async ({ actor, payload }) => {
  if (!actor?.id || !mongoose.Types.ObjectId.isValid(String(actor.id))) {
    const error = new Error('A valid authenticated user is required');
    error.statusCode = 401;
    throw error;
  }

  const dbUser = await User.findById(actor.id).lean();
  if (!dbUser) {
    const error = new Error('Submitting user not found');
    error.statusCode = 404;
    throw error;
  }

  const department = await ensureDepartment(payload.department || dbUser.department || 'General');
  const approvalType = await ensureApprovalType({
    rawType: payload.type || payload.title || 'GENERAL_REQUEST',
    departmentId: department._id,
  });

  const approvers = await getCandidateApprovers({ department: department.name });
  if (!approvers.length) {
    const error = new Error('No approvers are configured. Please create manager/admin users.');
    error.statusCode = 422;
    throw error;
  }

  const performanceMap = await getApproverPerformanceMap();
  const loadMap = await getApproverLoadMap();
  const rankedApprovers = scoreApproverCandidates({
    approvers,
    performanceMap,
    loadMap,
    department: department.name,
  });

  const selectedApprover = rankedApprovers[0];
  const prediction = await buildPrediction({
    payload: {
      ...payload,
      department: department.name,
    },
    selectedApprover,
    candidateApprovers: rankedApprovers,
  });

  const requestNumber = await generateRequestNumber();
  const requestDoc = await Request.create({
    requestNumber,
    title: String(payload.title || '').trim(),
    description: String(payload.description || '').trim(),
    type: String(payload.type || 'General').trim(),
    department: department.name,
    priority: normalizePriority(payload.priority),
    attachments: sanitizeAttachmentNames(payload.attachments),
    submittedBy: dbUser._id,
    requesterId: dbUser._id,
    departmentId: department._id,
    approvalTypeId: approvalType._id,
    currentLevel: 1,
    currentApprover: selectedApprover.user._id,
    currentApproverId: selectedApprover.user._id,
    status: 'PENDING',
    aiRiskScore: prediction.riskScore,
    riskLevel: prediction.riskLevel,
    predictedDelay: prediction.predictedDelayHours,
    predictedDelayHours: prediction.predictedDelayHours,
    predictedCompletionDate: prediction.predictedCompletionDate,
    aiSummary: prediction.aiSummary,
    requiredDocuments: prediction.requiredDocuments,
    missingDocuments: prediction.missingDocuments,
    routeRecommendations: prediction.smartRouteRecommendation,
    bottleneckWarnings: prediction.bottleneckWarnings,
    lastPredictionAt: new Date(),
    source: 'ai_engine',
    submittedAt: new Date(),
  });

  await Promise.all([
    ApprovalLog.create({
      requestId: requestDoc._id,
      approverId: selectedApprover.user._id,
      action: 'SUBMITTED',
      timestamp: new Date(),
      timeTaken: 0,
      department: department.name,
      notes: 'Request submitted through AI approval engine',
    }),
    AIPrediction.create({
      requestId: requestDoc._id,
      riskScore: prediction.riskScore,
      riskLevel: prediction.riskLevel,
      predictedDelayHours: prediction.predictedDelayHours,
      predictedCompletionDate: prediction.predictedCompletionDate,
      aiSummary: prediction.aiSummary,
      requiredDocuments: prediction.requiredDocuments,
      missingDocuments: prediction.missingDocuments,
      smartRouteRecommendation: prediction.smartRouteRecommendation,
      bottleneckWarnings: prediction.bottleneckWarnings,
      inputSnapshot: {
        amount: extractAmount(payload),
        priority: normalizePriority(payload.priority),
        department: department.name,
        attachmentCount: sanitizeAttachmentNames(payload.attachments).length,
      },
    }),
    Notification.create({
      userId: dbUser._id,
      requestId: requestDoc._id,
      type: 'AI_PREDICTION_READY',
      message:
        prediction.warningMessage ||
        `AI estimate ready. Predicted completion in ${prediction.predictedDelayHours}h.`,
    }),
    Notification.create({
      userId: selectedApprover.user._id,
      requestId: requestDoc._id,
      type: 'APPROVAL_NEEDED',
      message: `New request "${requestDoc.title}" assigned to you by smart routing engine.`,
    }),
  ]);

  const legacyRequestId = syncIntoLegacyWorkflow({
    payload: {
      ...payload,
      department: department.name,
      priority: normalizePriority(payload.priority),
    },
    actor: dbUser,
  });

  if (legacyRequestId) {
    requestDoc.legacyRequestId = legacyRequestId;
    await requestDoc.save();
  }

  return toApiRequest(requestDoc.toObject(), prediction);
};

const ensurePredictionForRequest = async (requestId) => {
  const request = await Request.findById(requestId).lean();
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }

  let latestPrediction = await AIPrediction.findOne({ requestId: request._id })
    .sort({ createdAt: -1 })
    .lean();

  if (!latestPrediction) {
    const approvers = await getCandidateApprovers({ department: request.department || 'General' });
    const performanceMap = await getApproverPerformanceMap();
    const loadMap = await getApproverLoadMap();
    const ranked = scoreApproverCandidates({
      approvers,
      performanceMap,
      loadMap,
      department: request.department || 'General',
    });
    const selected =
      ranked.find((row) => String(row.user._id) === String(request.currentApprover || request.currentApproverId)) ||
      ranked[0] ||
      { user: null, pendingCount: 0, avgTimeTaken: 30 };

    const prediction = await buildPrediction({
      payload: {
        title: request.title,
        description: request.description,
        type: request.type,
        department: request.department,
        priority: request.priority,
        attachments: request.attachments || [],
        amount: 0,
      },
      selectedApprover: selected,
      candidateApprovers: ranked,
    });

    latestPrediction = await AIPrediction.create({
      requestId: request._id,
      riskScore: prediction.riskScore,
      riskLevel: prediction.riskLevel,
      predictedDelayHours: prediction.predictedDelayHours,
      predictedCompletionDate: prediction.predictedCompletionDate,
      aiSummary: prediction.aiSummary,
      requiredDocuments: prediction.requiredDocuments,
      missingDocuments: prediction.missingDocuments,
      smartRouteRecommendation: prediction.smartRouteRecommendation,
      bottleneckWarnings: prediction.bottleneckWarnings,
      inputSnapshot: {
        generatedFrom: 'lazy_prediction',
      },
    });
  }

  const escalations = await Escalation.find({ requestId: request._id })
    .populate('fromApproverId', 'name role department')
    .populate('toApproverId', 'name role department')
    .sort({ escalatedAt: -1 })
    .lean();

  return {
    requestId: String(request._id),
    ...toApiRequest(request, latestPrediction),
    escalationHistory: escalations.map((item) => ({
      id: String(item._id),
      escalatedAt: item.escalatedAt,
      reason: item.reason,
      reminderSent: item.reminderSent,
      autoEscalated: item.autoEscalated,
      fromApprover: item.fromApproverId?.name || 'Unassigned',
      toApprover: item.toApproverId?.name || 'Unassigned',
      status: item.status,
    })),
  };
};

const chooseBackupApprover = async ({ request }) => {
  const approvers = await getCandidateApprovers({ department: request.department || 'General' });
  const performanceMap = await getApproverPerformanceMap();
  const loadMap = await getApproverLoadMap();
  const ranked = scoreApproverCandidates({
    approvers,
    performanceMap,
    loadMap,
    department: request.department || 'General',
  });

  return ranked.find((row) => String(row.user._id) !== String(request.currentApprover || request.currentApproverId)) || null;
};

const escalateRequest = async ({ requestId, reason, triggeredBy = null, autoEscalated = false }) => {
  const request = await Request.findById(requestId);
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }
  if (!PENDING_STATUSES.includes(String(request.status || '').toUpperCase())) {
    const error = new Error(`Request is not pending. Current status: ${request.status}`);
    error.statusCode = 409;
    throw error;
  }

  const now = new Date();
  const isDelayed =
    request.predictedCompletionDate &&
    new Date(request.predictedCompletionDate).getTime() <= now.getTime();

  if (!isDelayed && !reason) {
    const error = new Error('Request is not delayed yet. Provide escalation reason for manual override.');
    error.statusCode = 409;
    throw error;
  }

  const backup = await chooseBackupApprover({ request });
  const fromApproverId = request.currentApprover || request.currentApproverId || null;
  const reminderMessage = `Reminder: request "${request.title}" is pending beyond expected turnaround.`;

  if (fromApproverId) {
    await Notification.create({
      userId: fromApproverId,
      requestId: request._id,
      type: 'DELAY_REMINDER',
      message: reminderMessage,
    });
  }
  if (request.submittedBy || request.requesterId) {
    await Notification.create({
      userId: request.submittedBy || request.requesterId,
      requestId: request._id,
      type: 'ESCALATION_NOTICE',
      message: `Your request "${request.title}" has been escalated for faster processing.`,
    });
  }

  let escalationDoc = null;
  if (backup?.user?._id) {
    request.currentApprover = backup.user._id;
    request.currentApproverId = backup.user._id;
    request.status = 'ESCALATED';
    request.escalationCount = Number(request.escalationCount || 0) + 1;
    request.lastEscalatedAt = now;
    await request.save();

    escalationDoc = await Escalation.create({
      requestId: request._id,
      fromApproverId,
      toApproverId: backup.user._id,
      reason: reason || 'Predicted delay threshold crossed',
      escalatedAt: now,
      reminderSent: true,
      autoEscalated,
      status: 'OPEN',
      metadata: {
        triggeredBy: triggeredBy?.id || 'system',
      },
    });

    await Notification.create({
      userId: backup.user._id,
      requestId: request._id,
      type: 'ESCALATED_ASSIGNMENT',
      message: `Request "${request.title}" escalated to you as backup approver.`,
    });
  } else {
    escalationDoc = await Escalation.create({
      requestId: request._id,
      fromApproverId,
      toApproverId: null,
      reason: reason || 'Delayed request reminder without available backup approver',
      escalatedAt: now,
      reminderSent: true,
      autoEscalated,
      status: 'OPEN',
      metadata: {
        triggeredBy: triggeredBy?.id || 'system',
      },
    });
  }

  const pendingHours = Number(toHours(request.submittedAt || request.createdAt, now).toFixed(2));

  await ApprovalLog.insertMany([
    {
      requestId: request._id,
      approverId: fromApproverId,
      action: 'REMINDER_SENT',
      timestamp: now,
      timeTaken: pendingHours,
      department: request.department || 'General',
      notes: reminderMessage,
    },
    {
      requestId: request._id,
      approverId: backup?.user?._id || fromApproverId,
      action: autoEscalated ? 'AUTO_ESCALATED' : 'ESCALATED',
      timestamp: now,
      timeTaken: pendingHours,
      department: request.department || 'General',
      notes: reason || 'Escalated by smart workflow engine',
      metadata: {
        fromApproverId: fromApproverId ? String(fromApproverId) : '',
        toApproverId: backup?.user?._id ? String(backup.user._id) : '',
      },
    },
  ]);

  return {
    requestId: String(request._id),
    escalatedAt: now.toISOString(),
    reason: escalationDoc.reason,
    reminderSent: true,
    autoEscalated: escalationDoc.autoEscalated,
    fromApproverId: fromApproverId ? String(fromApproverId) : '',
    toApproverId: backup?.user?._id ? String(backup.user._id) : '',
    toApproverName: backup?.user?.name || '',
    pendingHours,
    message: backup?.user
      ? `Request escalated to ${backup.user.name}`
      : 'Reminder sent. No backup approver available.',
  };
};

const buildTrendSeries = (requests) => {
  const byDate = {};
  const now = new Date();
  for (let i = 13; i >= 0; i -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    byDate[day.toISOString().slice(0, 10)] = 0;
  }
  requests.forEach((request) => {
    const key = new Date(request.createdAt || request.submittedAt).toISOString().slice(0, 10);
    if (!(key in byDate)) return;
    byDate[key] += 1;
  });
  return Object.entries(byDate).map(([date, count]) => ({ date, count }));
};

const getDashboardAnalytics = async () => {
  const requests = await Request.find({ source: 'ai_engine' })
    .populate('currentApprover', 'name role department')
    .populate('currentApproverId', 'name role department')
    .sort({ createdAt: -1 })
    .lean();

  const escalations = await Escalation.find({}).sort({ escalatedAt: -1 }).lean();
  const decided = requests.filter((item) => DECIDED_STATUSES.includes(String(item.status || '').toUpperCase()));
  const pending = requests.filter((item) => PENDING_STATUSES.includes(String(item.status || '').toUpperCase()));
  const approved = decided.filter((item) => String(item.status).toUpperCase() === 'APPROVED');

  const decisionDurations = decided
    .map((item) => toHours(item.submittedAt || item.createdAt, item.finalizedAt || item.updatedAt))
    .filter((value) => value > 0);
  const averageApprovalTimeHours = Number(avg(decisionDurations).toFixed(2));

  const departmentMap = {};
  requests.forEach((item) => {
    const key = item.department || 'General';
    if (!departmentMap[key]) {
      departmentMap[key] = {
        department: key,
        total: 0,
        decidedDurations: [],
        pendingAges: [],
        approved: 0,
        rejected: 0,
      };
    }
    departmentMap[key].total += 1;
    if (String(item.status || '').toUpperCase() === 'APPROVED') departmentMap[key].approved += 1;
    if (String(item.status || '').toUpperCase() === 'REJECTED') departmentMap[key].rejected += 1;
    if (DECIDED_STATUSES.includes(String(item.status || '').toUpperCase())) {
      const hours = toHours(item.submittedAt || item.createdAt, item.finalizedAt || item.updatedAt);
      if (hours > 0) departmentMap[key].decidedDurations.push(hours);
    }
    if (PENDING_STATUSES.includes(String(item.status || '').toUpperCase())) {
      departmentMap[key].pendingAges.push(toHours(item.submittedAt || item.createdAt, new Date()));
    }
  });

  const departmentWiseDelays = Object.values(departmentMap).map((row) => ({
    department: row.department,
    averageDelayHours: Number(avg(row.decidedDurations).toFixed(2)),
    averagePendingHours: Number(avg(row.pendingAges).toFixed(2)),
    totalRequests: row.total,
    approvalSuccessRate: row.total ? Number(((row.approved / row.total) * 100).toFixed(1)) : 0,
  }));

  const bottleneckHeatmap = pending.map((item) => {
    const approver = item.currentApprover || item.currentApproverId || null;
    const pendingHours = toHours(item.submittedAt || item.createdAt, new Date());
    return {
      requestId: String(item._id),
      title: item.title,
      department: item.department || 'General',
      approverName: approver?.name || 'Unassigned',
      approverRole: approver?.role || '',
      pendingHours: Number(pendingHours.toFixed(2)),
      riskLevel: item.riskLevel || 'Low',
      predictedDelayHours: Number(item.predictedDelayHours || 0),
      isStuck: pendingHours >= Math.max(24, Number(item.predictedDelayHours || 0)),
    };
  });

  const slowApproversMap = {};
  bottleneckHeatmap.forEach((row) => {
    const key = row.approverName;
    if (!slowApproversMap[key]) {
      slowApproversMap[key] = {
        approverName: key,
        pendingCount: 0,
        _hours: [],
      };
    }
    slowApproversMap[key].pendingCount += 1;
    slowApproversMap[key]._hours.push(row.pendingHours);
  });

  const slowApprovers = Object.values(slowApproversMap)
    .map((row) => ({
      approverName: row.approverName,
      pendingCount: row.pendingCount,
      averagePendingHours: Number(avg(row._hours).toFixed(2)),
    }))
    .sort((a, b) => b.averagePendingHours - a.averagePendingHours)
    .slice(0, 6);

  const stuckRequests = bottleneckHeatmap
    .filter((item) => item.isStuck)
    .sort((a, b) => b.pendingHours - a.pendingHours)
    .slice(0, 12);

  const approvalSuccessRate = decided.length
    ? Number(((approved.length / decided.length) * 100).toFixed(1))
    : 0;

  const bottleneckWarnings = [
    ...slowApprovers
      .filter((item) => item.pendingCount >= 3 || item.averagePendingHours >= 40)
      .map(
        (item) =>
          `${item.approverName} queue is overloaded (${item.pendingCount} pending, avg ${item.averagePendingHours}h).`
      ),
    ...departmentWiseDelays
      .filter((item) => item.averagePendingHours >= 36)
      .map(
        (item) =>
          `${item.department} has elevated pending delay (${item.averagePendingHours}h average open age).`
      ),
  ].slice(0, 10);

  return {
    generatedAt: new Date().toISOString(),
    totalRequests: requests.length,
    averageApprovalTimeHours,
    approvalSuccessRate,
    pendingCount: pending.length,
    departmentWiseDelays,
    bottleneckHeatmap,
    stuckRequests,
    slowApprovers,
    bottleneckWarnings,
    requestTrends: buildTrendSeries(requests),
    escalations: {
      total: escalations.length,
      open: escalations.filter((item) => item.status === 'OPEN').length,
      autoEscalated: escalations.filter((item) => item.autoEscalated).length,
      recent: escalations.slice(0, 10).map((item) => ({
        id: String(item._id),
        requestId: String(item.requestId),
        reason: item.reason,
        escalatedAt: item.escalatedAt,
        autoEscalated: item.autoEscalated,
      })),
    },
    cards: {
      averageApprovalTimeHours,
      approvalSuccessRate,
      delayedRequests: stuckRequests.length,
      activeEscalations: escalations.filter((item) => item.status === 'OPEN').length,
    },
  };
};

const runAutoEscalationSweep = async () => {
  const staleRequests = await Request.find({
    source: 'ai_engine',
    status: { $in: PENDING_STATUSES },
    predictedCompletionDate: { $lte: new Date() },
  })
    .sort({ predictedCompletionDate: 1 })
    .limit(20)
    .lean();

  if (!staleRequests.length) {
    return { checked: 0, escalated: 0, skipped: 0, requestIds: [] };
  }

  let escalated = 0;
  let skipped = 0;
  const requestIds = [];

  for (const request of staleRequests) {
    const lastEscalationGapHours = request.lastEscalatedAt
      ? toHours(request.lastEscalatedAt, new Date())
      : Number.MAX_SAFE_INTEGER;

    if (lastEscalationGapHours < 6) {
      skipped += 1;
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      await escalateRequest({
        requestId: request._id,
        reason: 'Auto escalation triggered by delay prediction threshold',
        triggeredBy: { id: 'system' },
        autoEscalated: true,
      });
      escalated += 1;
      requestIds.push(String(request._id));
    } catch (error) {
      skipped += 1;
      logger.warn('Auto escalation skipped for request', {
        requestId: String(request._id),
        message: error.message,
      });
    }
  }

  return { checked: staleRequests.length, escalated, skipped, requestIds };
};

const seedAiWorkflowData = async () => {
  const existing = await Request.countDocuments({ source: 'ai_engine' });
  if (existing >= 6) {
    return { seeded: false, reason: 'already_seeded', count: existing };
  }

  const employees = await User.find({ role: 'employee' }).lean();
  const managers = await User.find({ role: { $in: ['manager', 'approver'] } }).lean();
  const admins = await User.find({ role: 'admin' }).lean();
  if (!employees.length || (!managers.length && !admins.length)) {
    return { seeded: false, reason: 'insufficient_users' };
  }

  const fallbackApprover = managers[0] || admins[0];
  const samplePayloads = [
    {
      title: 'Leave approval for medical emergency',
      description: 'Need 3 days leave due to medical emergency and doctor follow-up.',
      type: 'Leave Request',
      department: 'Operations',
      priority: 'high',
      amount: 0,
      attachments: ['medical-certificate.pdf'],
      status: 'APPROVED',
      ageHours: 84,
      decisionHours: 22,
    },
    {
      title: 'Purchase request for laptops',
      description: 'Procurement of 5 developer laptops for new hires in project team.',
      type: 'Purchase Request',
      department: 'Finance',
      priority: 'high',
      amount: 14500,
      attachments: ['vendor-quote.pdf', 'budget-note.pdf'],
      status: 'REJECTED',
      ageHours: 110,
      decisionHours: 44,
    },
    {
      title: 'Travel approval for client workshop',
      description: 'Travel request for onsite client workshop and implementation planning.',
      type: 'Travel Request',
      department: 'Operations',
      priority: 'medium',
      amount: 6200,
      attachments: ['itinerary.pdf'],
      status: 'PENDING',
      ageHours: 60,
    },
    {
      title: 'Expense reimbursement for cloud certification',
      description: 'Reimbursement for completed cloud certification exam and preparation materials.',
      type: 'Expense Reimbursement',
      department: 'Human Resources',
      priority: 'medium',
      amount: 1800,
      attachments: ['invoice.pdf'],
      status: 'PENDING',
      ageHours: 28,
    },
    {
      title: 'Emergency software license renewal',
      description: 'Critical license renewal required to avoid disruption in production support.',
      type: 'Software Request',
      department: 'Finance',
      priority: 'critical',
      amount: 22000,
      attachments: ['vendor-quote.pdf', 'risk-assessment.pdf'],
      status: 'APPROVED',
      ageHours: 92,
      decisionHours: 30,
    },
    {
      title: 'Access request for analytics platform',
      description: 'Need analytics platform access for quarterly business reporting.',
      type: 'Access Request',
      department: 'Operations',
      priority: 'low',
      amount: 0,
      attachments: [],
      status: 'PENDING',
      ageHours: 52,
    },
  ];

  const createdIds = [];
  for (let index = 0; index < samplePayloads.length; index += 1) {
    const sample = samplePayloads[index];
    const actor = employees[index % employees.length];
    // eslint-disable-next-line no-await-in-loop
    const department = await ensureDepartment(sample.department);
    // eslint-disable-next-line no-await-in-loop
    const approvalType = await ensureApprovalType({
      rawType: sample.type,
      departmentId: department._id,
    });
    // eslint-disable-next-line no-await-in-loop
    const requestNumber = await generateRequestNumber();
    const createdAt = new Date(Date.now() - sample.ageHours * 60 * 60 * 1000);

    // eslint-disable-next-line no-await-in-loop
    const prediction = await buildPrediction({
      payload: sample,
      selectedApprover: {
        user: fallbackApprover,
        pendingCount: 2 + (index % 3),
        avgTimeTaken: 26 + index * 2,
      },
      candidateApprovers: [
        {
          user: fallbackApprover,
          pendingCount: 2,
          avgTimeTaken: 26,
        },
      ],
    });

    // eslint-disable-next-line no-await-in-loop
    const requestDoc = await Request.create({
      requestNumber,
      title: sample.title,
      description: sample.description,
      type: sample.type,
      department: sample.department,
      priority: normalizePriority(sample.priority),
      attachments: sample.attachments,
      submittedBy: actor._id,
      requesterId: actor._id,
      departmentId: department._id,
      approvalTypeId: approvalType._id,
      currentLevel: 1,
      currentApprover: fallbackApprover._id,
      currentApproverId: fallbackApprover._id,
      status: sample.status,
      submittedAt: createdAt,
      createdAt,
      updatedAt: new Date(),
      finalizedAt:
        sample.status === 'APPROVED' || sample.status === 'REJECTED'
          ? new Date(createdAt.getTime() + (sample.decisionHours || 24) * 60 * 60 * 1000)
          : null,
      aiRiskScore: prediction.riskScore,
      riskLevel: prediction.riskLevel,
      predictedDelay: prediction.predictedDelayHours,
      predictedDelayHours: prediction.predictedDelayHours,
      predictedCompletionDate: new Date(createdAt.getTime() + prediction.predictedDelayHours * 60 * 60 * 1000),
      aiSummary: prediction.aiSummary,
      requiredDocuments: prediction.requiredDocuments,
      missingDocuments: prediction.missingDocuments,
      routeRecommendations: prediction.smartRouteRecommendation,
      bottleneckWarnings: prediction.bottleneckWarnings,
      lastPredictionAt: createdAt,
      source: 'ai_engine',
      escalationCount: sample.status === 'PENDING' && sample.ageHours > 50 ? 1 : 0,
      lastEscalatedAt:
        sample.status === 'PENDING' && sample.ageHours > 50
          ? new Date(Date.now() - 8 * 60 * 60 * 1000)
          : null,
    });

    createdIds.push(String(requestDoc._id));

    // eslint-disable-next-line no-await-in-loop
    await ApprovalLog.create({
      requestId: requestDoc._id,
      approverId: fallbackApprover._id,
      action: 'SUBMITTED',
      timestamp: createdAt,
      timeTaken: 0,
      department: sample.department,
      notes: 'Seeded request submission',
    });

    if (sample.status === 'APPROVED' || sample.status === 'REJECTED') {
      // eslint-disable-next-line no-await-in-loop
      await ApprovalLog.create({
        requestId: requestDoc._id,
        approverId: fallbackApprover._id,
        action: sample.status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
        timestamp: requestDoc.finalizedAt,
        timeTaken: Number(sample.decisionHours || 24),
        department: sample.department,
        notes: 'Seeded final decision',
      });
    }

    if (sample.status === 'PENDING' && sample.ageHours > 50) {
      // eslint-disable-next-line no-await-in-loop
      await Escalation.create({
        requestId: requestDoc._id,
        fromApproverId: fallbackApprover._id,
        toApproverId: admins[0]?._id || null,
        reason: 'Seeded escalation for delayed request',
        escalatedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
        reminderSent: true,
        autoEscalated: true,
        status: 'OPEN',
      });
    }

    // eslint-disable-next-line no-await-in-loop
    await AIPrediction.create({
      requestId: requestDoc._id,
      riskScore: prediction.riskScore,
      riskLevel: prediction.riskLevel,
      predictedDelayHours: prediction.predictedDelayHours,
      predictedCompletionDate: requestDoc.predictedCompletionDate,
      aiSummary: prediction.aiSummary,
      requiredDocuments: prediction.requiredDocuments,
      missingDocuments: prediction.missingDocuments,
      smartRouteRecommendation: prediction.smartRouteRecommendation,
      bottleneckWarnings: prediction.bottleneckWarnings,
      inputSnapshot: {
        seeded: true,
      },
      createdAt,
      updatedAt: createdAt,
    });
  }

  logger.info('AI workflow seed data initialized', { count: createdIds.length });
  return { seeded: true, count: createdIds.length, requestIds: createdIds };
};

module.exports = {
  createRequestWithPrediction,
  ensurePredictionForRequest,
  escalateRequest,
  getDashboardAnalytics,
  runAutoEscalationSweep,
  seedAiWorkflowData,
};

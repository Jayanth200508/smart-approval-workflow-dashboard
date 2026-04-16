const {
  listRequests,
  users,
  updateRequest,
  findRequestById,
  createNotification,
} = require('../data/mockStore');
const config = require('../config');
const logger = require('../utils/logger');
const {
  avg,
  hoursBetween,
  normalizeStatus,
  resolveSubmittedAt,
  resolveDecisionAt,
  getRequestHistory,
  buildDepartmentBuckets,
  getApproverStats,
  getApproverLoadSnapshot,
  findSimilarRequests,
} = require('../repository/requestAnalytics.repository');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const stdDev = (values) => {
  if (!values.length) return 0;
  const mean = avg(values);
  const variance = avg(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
};

const cache = new Map();
const CACHE_TTL_MS = 20 * 1000;

const getCache = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

const setCache = (key, value, ttlMs = CACHE_TTL_MS) => {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
};

const invalidateCache = () => cache.clear();

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const stageLabels = {
  submissionToManager: 'Submit -> Manager',
  managerToAdmin: 'Manager -> Admin',
  adminToDecision: 'Admin -> Decision',
  endToEnd: 'End-to-End',
};

const extractManagerReviewTimestamp = (request) => {
  const event = (request.auditTrail || []).find((item) =>
    ['manager_approved', 'manager_rejected'].includes(item.action)
  );
  return event?.timestamp || null;
};

const extractAdminReviewTimestamp = (request) => {
  const event = (request.auditTrail || []).find((item) => ['admin_approved', 'admin_rejected'].includes(item.action));
  return event?.timestamp || null;
};

const getStageDurations = (request) => {
  const submittedAt = resolveSubmittedAt(request);
  const managerAt = extractManagerReviewTimestamp(request);
  const adminAt = extractAdminReviewTimestamp(request);
  const decisionAt = resolveDecisionAt(request);

  return {
    submissionToManager: hoursBetween(submittedAt, managerAt),
    managerToAdmin: hoursBetween(managerAt, adminAt),
    adminToDecision: hoursBetween(adminAt, decisionAt),
    endToEnd: hoursBetween(submittedAt, decisionAt),
  };
};

const computeFrictionIntelligence = (requests) => {
  const byDepartmentAndStage = {};
  const stageBuckets = {
    submissionToManager: [],
    managerToAdmin: [],
    adminToDecision: [],
    endToEnd: [],
  };

  requests.forEach((request) => {
    const department = request.department || 'General';
    if (!byDepartmentAndStage[department]) {
      byDepartmentAndStage[department] = {
        submissionToManager: [],
        managerToAdmin: [],
        adminToDecision: [],
        endToEnd: [],
      };
    }

    const stage = getStageDurations(request);
    Object.keys(stage).forEach((key) => {
      if (stage[key] > 0) {
        byDepartmentAndStage[department][key].push(stage[key]);
        stageBuckets[key].push(stage[key]);
      }
    });
  });

  const frictionHeatmap = Object.entries(byDepartmentAndStage).map(([department, values]) => ({
    department,
    submissionToManager: Number(avg(values.submissionToManager).toFixed(2)),
    managerToAdmin: Number(avg(values.managerToAdmin).toFixed(2)),
    adminToDecision: Number(avg(values.adminToDecision).toFixed(2)),
    endToEnd: Number(avg(values.endToEnd).toFixed(2)),
  }));

  const delayVariance = Object.entries(stageBuckets).map(([stage, values]) => ({
    stage,
    label: stageLabels[stage],
    varianceHours: Number(stdDev(values).toFixed(2)),
    averageHours: Number(avg(values).toFixed(2)),
  }));

  const healthPenalty =
    avg(delayVariance.map((item) => item.varianceHours)) * 3.2 +
    avg(delayVariance.map((item) => item.averageHours)) * 1.6;

  return {
    frictionHeatmap,
    delayVariance,
    workflowHealthScore: Number(clamp(100 - healthPenalty, 8, 100).toFixed(1)),
  };
};
const computeDecisionPatterns = (requests) => {
  const approverMap = {};
  const monthly = {};

  requests.forEach((request) => {
    (request.auditTrail || []).forEach((event) => {
      if (!['manager_approved', 'manager_rejected', 'admin_approved', 'admin_rejected'].includes(event.action)) return;

      const approverName = event.actorName || 'Unknown';
      if (!approverMap[approverName]) {
        approverMap[approverName] = {
          approver: approverName,
          approvals: 0,
          rejections: 0,
          reviewed: 0,
          reviewHours: [],
        };
      }

      const row = approverMap[approverName];
      row.reviewed += 1;
      if (event.action.endsWith('approved')) row.approvals += 1;
      if (event.action.endsWith('rejected')) row.rejections += 1;
      const reviewHours = hoursBetween(resolveSubmittedAt(request), event.timestamp);
      if (reviewHours > 0) row.reviewHours.push(reviewHours);

      const month = new Date(event.timestamp).toISOString().slice(0, 7);
      if (!monthly[month]) monthly[month] = { month };
      if (!monthly[month][`${approverName}_approved`]) monthly[month][`${approverName}_approved`] = 0;
      if (!monthly[month][`${approverName}_rejected`]) monthly[month][`${approverName}_rejected`] = 0;
      if (event.action.endsWith('approved')) monthly[month][`${approverName}_approved`] += 1;
      if (event.action.endsWith('rejected')) monthly[month][`${approverName}_rejected`] += 1;
    });
  });

  const globalApprovals = Object.values(approverMap).reduce((sum, item) => sum + item.approvals, 0);
  const globalRejections = Object.values(approverMap).reduce((sum, item) => sum + item.rejections, 0);
  const globalRejectionRate = globalApprovals + globalRejections ? globalRejections / (globalApprovals + globalRejections) : 0;

  const approverTrends = Object.values(approverMap).map((item) => {
    const total = item.approvals + item.rejections;
    const rejectionRate = total ? item.rejections / total : 0;
    return {
      approver: item.approver,
      approvals: item.approvals,
      rejections: item.rejections,
      rejectionRate: Number((rejectionRate * 100).toFixed(1)),
      biasIndicator: Number((Math.abs(rejectionRate - globalRejectionRate) * 100).toFixed(1)),
      avgReviewHours: Number(avg(item.reviewHours).toFixed(2)),
      reviewed: item.reviewed,
    };
  });

  return {
    approverTrends,
    behaviorTrend: Object.values(monthly).sort((a, b) => (a.month > b.month ? 1 : -1)),
  };
};

const computeRiskScoring = (requests) => {
  const context = buildDepartmentBuckets(requests);
  const requestRisk = requests.map((request) => {
    const amount = Number(request.amount || 0);
    const department = request.department || 'General';
    const history = context[department] || { total: 0, rejected: 0, cycleHours: [] };
    const rejectRate = history.total ? history.rejected / history.total : 0;
    const cycle = hoursBetween(resolveSubmittedAt(request), resolveDecisionAt(request));
    const variance = Math.abs(cycle - avg(history.cycleHours || [0]));
    const raw =
      Math.min(40, amount / 500) +
      rejectRate * 30 +
      Math.min(20, variance * 1.2) +
      (normalizeStatus(request.priority) === 'high' ? 10 : 0);
    const riskScore = Number(clamp(raw, 0, 100).toFixed(1));
    const riskLevel = riskScore >= 67 ? 'High' : riskScore >= 34 ? 'Medium' : 'Low';
    return {
      requestId: request.id,
      title: request.title,
      department,
      riskLevel,
      riskScore,
      amount,
      status: normalizeStatus(request.status),
    };
  });

  const riskDistribution = [
    { name: 'Low', value: requestRisk.filter((item) => item.riskLevel === 'Low').length },
    { name: 'Medium', value: requestRisk.filter((item) => item.riskLevel === 'Medium').length },
    { name: 'High', value: requestRisk.filter((item) => item.riskLevel === 'High').length },
  ];

  return { requestRisk, riskDistribution };
};

const computeLoadMeter = (requests) => {
  const pending = requests.filter((item) => normalizeStatus(item.status) === 'pending').length;
  const adminReview = requests.filter((item) => normalizeStatus(item.status) === 'admin_review').length;
  const reviewers = users.filter((item) => ['manager', 'admin'].includes(String(item.role || '').toLowerCase())).length || 1;
  const capacity = reviewers * config.workflowOverloadThreshold;
  const currentLoad = pending + adminReview;
  const loadPercent = Number(clamp((currentLoad / capacity) * 100, 0, 100).toFixed(1));
  const overload = loadPercent >= 78;

  const trafficByDay = {};
  requests.forEach((request) => {
    const day = new Date(resolveSubmittedAt(request)).toISOString().slice(0, 10);
    trafficByDay[day] = (trafficByDay[day] || 0) + 1;
  });

  const trafficTrend = Object.entries(trafficByDay)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .slice(-14)
    .map(([date, volume]) => ({ date, volume }));

  return { loadPercent, overload, currentLoad, capacity, trafficTrend };
};

const computeFairnessIndex = (requests) => {
  const managerMap = {};
  requests.forEach((request) => {
    const managerEvent = (request.auditTrail || []).find((item) =>
      ['manager_approved', 'manager_rejected'].includes(item.action)
    );
    if (!managerEvent) return;
    const key = managerEvent.actorName || 'Unknown';
    managerMap[key] = (managerMap[key] || 0) + 1;
  });

  const loads = Object.entries(managerMap).map(([manager, handled]) => ({ manager, handled }));
  const handledValues = loads.map((item) => item.handled);
  const mean = avg(handledValues);
  const coefficientVariance = mean ? stdDev(handledValues) / mean : 0;
  const fairnessScore = Number(clamp(100 - coefficientVariance * 100, 10, 100).toFixed(1));
  return { fairnessScore, loads };
};

const suggestFastestResolvers = (requests) => {
  const stats = getApproverStats(requests);
  return stats
    .map((item) => ({
      approver: item.approverName,
      avgReviewHours: item.avgReviewHours,
      approvalRate: Number(((item.approved / Math.max(1, item.reviewed)) * 100).toFixed(1)),
      reviewed: item.reviewed,
    }))
    .sort((a, b) => a.avgReviewHours - b.avgReviewHours || b.approvalRate - a.approvalRate)
    .slice(0, 5);
};

const getProcessDnaByDepartment = (department, requests = getRequestHistory()) => {
  const scoped = requests.filter((item) => (item.department || 'General') === department);
  if (!scoped.length) {
    return {
      department,
      delayFactor: 0,
      riskRatio: 0,
      efficiencyScore: 0,
      bottleneckSummary: 'No historical data available.',
      requestCount: 0,
    };
  }

  const delayFactor = Number(
    avg(scoped.map((item) => getStageDurations(item).endToEnd).filter((value) => value > 0)).toFixed(2)
  );
  const risk = computeRiskScoring(scoped);
  const highRisk = risk.requestRisk.filter((item) => item.riskLevel === 'High').length;
  const riskRatio = Number(((highRisk / scoped.length) * 100).toFixed(1));
  const rejectionRate =
    scoped.filter((item) => normalizeStatus(item.status) === 'rejected').length / Math.max(1, scoped.length);
  const efficiencyScore = Number(clamp(100 - delayFactor * 1.8 - rejectionRate * 55, 6, 100).toFixed(1));
  const bottleneckSummary =
    delayFactor > 48
      ? 'Critical delay observed between submission and final decisioning.'
      : delayFactor > 24
        ? 'Moderate delay detected. Manager queue balancing recommended.'
        : 'Healthy flow with low queue friction.';

  return {
    department,
    delayFactor,
    riskRatio,
    efficiencyScore,
    bottleneckSummary,
    requestCount: scoped.length,
  };
};

const getSuggestedDocuments = ({ type, amount, department }) => {
  const requestType = String(type || '').toLowerCase();
  const docs = new Set(['Business justification note']);
  if (requestType.includes('travel')) {
    docs.add('Travel itinerary');
    docs.add('Cost estimate sheet');
  }
  if (requestType.includes('expense')) docs.add('Invoice / receipt bundle');
  if (requestType.includes('software') || requestType.includes('access') || requestType.includes('vpn')) {
    docs.add('Access scope and manager approval note');
  }
  if (toNumber(amount) >= 10000) {
    docs.add('Budget owner sign-off document');
    docs.add('Risk impact assessment');
  }
  if (String(department || '').toLowerCase() === 'finance') docs.add('Compliance checklist');
  return [...docs];
};

const getMissingFields = (payload = {}) => {
  const missing = [];
  if (!String(payload.title || '').trim()) missing.push('title');
  if (!String(payload.type || '').trim()) missing.push('type');
  if (!String(payload.department || '').trim()) missing.push('department');
  if (!String(payload.priority || '').trim()) missing.push('priority');
  if (toNumber(payload.amount, -1) < 0) missing.push('amount');

  const description = String(payload.description || '').trim();
  if (!description) missing.push('description');
  else if (description.length < 30) missing.push('description_detail');

  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  if (attachments.length === 0 && toNumber(payload.amount) >= 12000) missing.push('supporting_documents');
  if (!payload.expectedDate && !payload.dueAt) missing.push('expected_date');
  return missing;
};

const estimateApprovalHours = ({ payload, baselineHours, frictionHours }) => {
  const amount = toNumber(payload.amount);
  const priority = String(payload.priority || 'medium').toLowerCase();
  const urgency = String(payload.urgency || 'normal').toLowerCase();
  const amountPenalty = amount > 20000 ? 26 : amount > 10000 ? 16 : amount > 5000 ? 8 : 2;
  const priorityPenalty = priority === 'critical' ? 20 : priority === 'high' ? 12 : priority === 'medium' ? 6 : 1;
  const urgencyAdjustment = urgency === 'urgent' ? -3 : 0;
  return Number(Math.max(2, baselineHours + amountPenalty + priorityPenalty + urgencyAdjustment + frictionHours).toFixed(2));
};

const predictApprovalOutcome = (payload = {}) => {
  const history = getRequestHistory();
  const similar = findSimilarRequests(payload, history);
  const pool = similar.length >= 4 ? similar : history;
  const approved = pool.filter((item) => normalizeStatus(item.status) === 'approved').length;
  const rejected = pool.filter((item) => normalizeStatus(item.status) === 'rejected').length;
  const totalDecided = approved + rejected;
  const baselineApprovalRate = totalDecided ? approved / totalDecided : 0.72;

  const departmentBuckets = buildDepartmentBuckets(history);
  const deptHistory = departmentBuckets[payload.department] || { total: 0, approved: 0, rejected: 0, cycleHours: [] };
  const deptRejectRate = deptHistory.total ? deptHistory.rejected / deptHistory.total : 0.2;
  const amount = toNumber(payload.amount);
  const priority = String(payload.priority || 'medium').toLowerCase();
  const urgency = String(payload.urgency || 'normal').toLowerCase();
  const missingFields = getMissingFields(payload);

  let score = baselineApprovalRate;
  if (amount > 20000) score -= 0.22;
  else if (amount > 10000) score -= 0.12;
  else if (amount < 3000) score += 0.08;
  if (priority === 'critical') score -= 0.14;
  else if (priority === 'high') score -= 0.09;
  else if (priority === 'low') score += 0.04;
  if (urgency === 'urgent') score -= 0.05;
  score -= deptRejectRate * 0.12;
  score -= missingFields.length * 0.018;
  const approvalChance = Number((clamp(score, 0.04, 0.96) * 100).toFixed(1));

  const endToEndCycles = pool.map((item) => getStageDurations(item).endToEnd).filter((value) => value > 0);
  const baselineHours = avg(endToEndCycles) || 24;
  const friction = computeFrictionIntelligence(history);
  const maxFrictionStage = [...friction.delayVariance].sort((a, b) => b.averageHours - a.averageHours)[0];
  const frictionHours = maxFrictionStage ? maxFrictionStage.averageHours * 0.12 : 0;
  const estimatedApprovalHours = estimateApprovalHours({ payload, baselineHours, frictionHours });

  const bottleneckSignals = [];
  if (maxFrictionStage?.averageHours >= 18) {
    bottleneckSignals.push(`${maxFrictionStage.label} is trending slow (${maxFrictionStage.averageHours.toFixed(1)}h avg).`);
  }
  if (deptRejectRate >= 0.35) {
    bottleneckSignals.push(`Department rejection trend is elevated (${Math.round(deptRejectRate * 100)}%).`);
  }
  if (amount > 10000) bottleneckSignals.push('High-amount request requires stricter admin review path.');
  const approverLoads = getApproverLoadSnapshot(history);
  const overloadedApprovers = approverLoads.filter((item) => item.pendingCount >= config.workflowOverloadThreshold);
  if (overloadedApprovers.length) bottleneckSignals.push(`${overloadedApprovers.length} approver queue(s) are currently overloaded.`);

  const sampleConfidence = clamp((pool.length / 22) * 100, 18, 95);
  const completeness = clamp(100 - missingFields.length * 11, 20, 100);
  const confidenceScore = Number((sampleConfidence * 0.6 + completeness * 0.4).toFixed(1));

  const recommendations = [];
  if (missingFields.includes('description_detail')) recommendations.push('Add more business context to the description.');
  if (missingFields.includes('supporting_documents')) recommendations.push('Attach supporting financial/compliance documents.');
  if (approvalChance < 55) recommendations.push('Route through pre-review with your manager before formal submission.');
  if (!recommendations.length) recommendations.push('Request quality is strong for current policy rules.');

  return {
    approvalChance,
    confidenceScore,
    estimatedApprovalHours,
    bottleneckRisk: approvalChance < 45 ? 'High' : approvalChance < 65 ? 'Medium' : 'Low',
    bottleneckSignals,
    missingFields,
    suggestedDocuments: getSuggestedDocuments(payload),
    recommendations,
  };
};

const pickBestAlternateApprover = ({ request, approverStats, approverLoads }) => {
  const approverUsers = users.filter((item) => ['manager', 'admin'].includes(String(item.role || '').toLowerCase()));
  if (!approverUsers.length) return null;
  const currentApproverId = request.assignedManagerId || request.currentApproverId || null;
  const candidates = approverUsers
    .filter((item) => item.id !== currentApproverId)
    .map((item) => {
      const load = approverLoads.find((row) => row.approverId === item.id) || { pendingCount: 0, oldestPendingHours: 0 };
      const stats = approverStats.find((row) => row.approverId === item.id) || { avgReviewHours: 24, rejectionRate: 0.2 };
      const departmentAlignment =
        String(item.department || '').toLowerCase() === String(request.department || '').toLowerCase() ? 1 : 0;
      const score =
        load.pendingCount * 10 +
        load.oldestPendingHours * 0.8 +
        toNumber(stats.avgReviewHours, 24) * 1.2 +
        toNumber(stats.rejectionRate, 0.2) * 20 -
        departmentAlignment * 6;
      return {
        approverId: item.id,
        approverName: item.name,
        approverRole: item.role,
        score: Number(score.toFixed(2)),
      };
    })
    .sort((a, b) => a.score - b.score);
  return candidates[0] || null;
};

const getAdaptiveWorkflowInsights = (options = {}) => {
  const requests = getRequestHistory();
  const approverLoads = getApproverLoadSnapshot(requests);
  const approverStats = getApproverStats(requests);
  const inactivityThreshold = Number(options.inactivityThresholdHours || config.workflowInactivityThresholdHours);
  const escalationThreshold = Number(options.escalationThresholdHours || config.workflowEscalationThresholdHours);
  const overloadThreshold = Number(options.overloadThreshold || config.workflowOverloadThreshold);

  const overloadedApprovers = approverLoads
    .filter((item) => item.pendingCount >= overloadThreshold)
    .map((item) => {
      const user = users.find((row) => row.id === item.approverId);
      return {
        approverId: item.approverId,
        approverName: user?.name || item.approverId,
        pendingCount: item.pendingCount,
        oldestPendingHours: item.oldestPendingHours,
      };
    });

  const inactiveApprovers = approverLoads
    .filter((item) => item.oldestPendingHours >= inactivityThreshold)
    .map((item) => {
      const user = users.find((row) => row.id === item.approverId);
      return {
        approverId: item.approverId,
        approverName: user?.name || item.approverId,
        pendingCount: item.pendingCount,
        oldestPendingHours: item.oldestPendingHours,
      };
    });

  const openRequests = requests.filter((item) => ['pending', 'admin_review'].includes(normalizeStatus(item.status)));
  const staleRequests = openRequests
    .map((request) => {
      const pendingHours = hoursBetween(resolveSubmittedAt(request), new Date().toISOString());
      const assignedApprover = users.find((item) => item.id === request.assignedManagerId || item.id === request.currentApproverId);
      return {
        requestId: request.id,
        title: request.title,
        department: request.department || 'General',
        status: normalizeStatus(request.status),
        pendingHours: Number(pendingHours.toFixed(2)),
        assignedApproverId: assignedApprover?.id || request.assignedManagerId || null,
        assignedApproverName: assignedApprover?.name || 'Unassigned',
      };
    })
    .filter((item) => item.pendingHours >= inactivityThreshold)
    .sort((a, b) => b.pendingHours - a.pendingHours);

  const suggestedReroutes = staleRequests.slice(0, 8).map((item) => {
    const request = requests.find((row) => row.id === item.requestId);
    const alternate = request ? pickBestAlternateApprover({ request, approverStats, approverLoads }) : null;
    return {
      requestId: item.requestId,
      requestTitle: item.title,
      currentApprover: item.assignedApproverName,
      suggestedApprover: alternate?.approverName || null,
      suggestedApproverId: alternate?.approverId || null,
      pendingHours: item.pendingHours,
      confidence: alternate ? Number(clamp(88 - alternate.score, 35, 92).toFixed(1)) : 0,
      reason: alternate ? 'Lower queue load and faster review velocity detected.' : 'No alternate approver available right now.',
    };
  });

  const escalationAlerts = staleRequests
    .filter((item) => item.pendingHours >= escalationThreshold)
    .map((item) => ({
      requestId: item.requestId,
      title: item.title,
      pendingHours: item.pendingHours,
      severity: item.pendingHours >= escalationThreshold * 1.5 ? 'critical' : 'warning',
      message: `${item.title} has been pending for ${item.pendingHours.toFixed(1)} hours and requires escalation.`,
    }));

  const realtimeStatus = {
    queueHealth: escalationAlerts.length ? 'critical' : overloadedApprovers.length ? 'warning' : 'healthy',
    openQueue: openRequests.length,
    overloadRatio: Number((overloadedApprovers.length / Math.max(1, users.filter((item) => ['manager', 'admin'].includes(item.role)).length)).toFixed(2)),
    avgPendingHours: Number(avg(staleRequests.map((item) => item.pendingHours)).toFixed(2)),
  };

  return {
    overloadedApprovers,
    inactiveApprovers,
    staleRequests,
    escalationAlerts,
    suggestedReroutes,
    realtimeStatus,
  };
};

const rerouteRequest = ({ requestId, reason, requestedBy }) => {
  const request = findRequestById(requestId);
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }

  const status = normalizeStatus(request.status);
  if (!['pending', 'admin_review'].includes(status)) {
    const error = new Error('Only pending/admin_review requests can be rerouted');
    error.statusCode = 409;
    throw error;
  }

  const requests = getRequestHistory();
  const approverLoads = getApproverLoadSnapshot(requests);
  const approverStats = getApproverStats(requests);
  const alternate = pickBestAlternateApprover({ request, approverStats, approverLoads });
  if (!alternate) {
    const error = new Error('No alternate approver available for rerouting');
    error.statusCode = 409;
    throw error;
  }

  const previousApproverId = request.assignedManagerId || request.currentApproverId || null;
  const updated = updateRequest(requestId, (target) => {
    target.assignedManagerId = alternate.approverId;
    target.currentApproverId = alternate.approverId;
    target.auditTrail = target.auditTrail || [];
    target.auditTrail.push({
      action: 'rerouted',
      actorId: requestedBy?.id || 'system',
      actorName: requestedBy?.name || 'Workflow Intelligence Engine',
      actorRole: requestedBy?.role || 'system',
      comment: reason || 'Auto-rerouted due to approver load/inactivity',
      timestamp: new Date().toISOString(),
      metadata: { previousApproverId, nextApproverId: alternate.approverId },
    });
  });

  if (!updated) {
    const error = new Error('Failed to reroute request');
    error.statusCode = 500;
    throw error;
  }

  createNotification({
    userId: alternate.approverId,
    title: 'Request Rerouted to You',
    message: `${updated.title} has been rerouted for faster review.`,
    type: 'warning',
  });
  if (updated.requesterId) {
    createNotification({
      userId: updated.requesterId,
      title: 'Request Rerouted',
      message: `${updated.title} has been reassigned to reduce approval delay.`,
      type: 'info',
    });
  }

  invalidateCache();
  return {
    requestId: updated.id,
    requestTitle: updated.title,
    previousApproverId,
    nextApproverId: alternate.approverId,
    nextApproverName: alternate.approverName,
    reason: reason || 'Rerouted by adaptive workflow engine',
    reroutedAt: new Date().toISOString(),
  };
};

const monitorWorkflowAndEscalate = ({ dryRun = false } = {}) => {
  const intelligence = getAdaptiveWorkflowInsights();
  const escalationThreshold = Number(config.workflowEscalationThresholdHours);
  const escalatedRequestIds = [];
  const reroutedRequestIds = [];

  intelligence.staleRequests.forEach((row) => {
    if (row.pendingHours < escalationThreshold) return;
    const request = findRequestById(row.requestId);
    if (!request) return;
    const alreadyEscalated = (request.auditTrail || []).some(
      (entry) => entry.action === 'auto_escalated' && hoursBetween(entry.timestamp, new Date().toISOString()) < 12
    );
    if (alreadyEscalated) return;

    if (!dryRun) {
      updateRequest(request.id, (target) => {
        target.auditTrail = target.auditTrail || [];
        if (normalizeStatus(target.status) === 'pending') target.status = 'admin_review';
        target.auditTrail.push({
          action: 'auto_escalated',
          actorId: 'system',
          actorName: 'Workflow Monitor Scheduler',
          actorRole: 'system',
          comment: `Auto escalation triggered after ${row.pendingHours.toFixed(1)} hours pending.`,
          timestamp: new Date().toISOString(),
        });
      });

      escalatedRequestIds.push(request.id);
      const suggestion = intelligence.suggestedReroutes.find((item) => item.requestId === request.id);
      if (suggestion?.suggestedApproverId && suggestion.suggestedApproverId !== request.assignedManagerId) {
        try {
          rerouteRequest({
            requestId: request.id,
            reason: 'Automated reroute due to escalation threshold breach',
            requestedBy: { id: 'system', name: 'Workflow Monitor Scheduler', role: 'system' },
          });
          reroutedRequestIds.push(request.id);
        } catch (error) {
          logger.warn('Auto-reroute skipped for escalated request', { requestId: request.id, message: error.message });
        }
      }
    }
  });

  if (!dryRun && escalatedRequestIds.length) {
    users
      .filter((item) => String(item.role || '').toLowerCase() === 'admin')
      .forEach((admin) => {
        createNotification({
          userId: admin.id,
          title: 'Escalation Alert',
          message: `${escalatedRequestIds.length} request(s) auto-escalated by workflow monitor.`,
          type: 'warning',
        });
      });
  }

  if (!dryRun && (escalatedRequestIds.length || reroutedRequestIds.length)) invalidateCache();

  return {
    dryRun,
    evaluatedAt: new Date().toISOString(),
    escalatedCount: escalatedRequestIds.length,
    reroutedCount: reroutedRequestIds.length,
    escalatedRequestIds,
    reroutedRequestIds,
    alerts: intelligence.escalationAlerts,
  };
};

const getFairnessDiagnostics = () => {
  const requests = getRequestHistory();
  const decided = requests.filter((item) => ['approved', 'rejected'].includes(normalizeStatus(item.status)));
  const buckets = {};

  decided.forEach((request) => {
    const amount = toNumber(request.amount);
    const amountBand = amount < 5000 ? 'low' : amount < 15000 ? 'mid' : 'high';
    const key = `${String(request.type || '').toLowerCase()}|${String(request.department || '').toLowerCase()}|${amountBand}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(request);
  });

  const similarRequestComparisons = [];
  const auditTrail = [];

  Object.values(buckets).forEach((group) => {
    if (group.length < 4) return;
    const approvals = group.filter((item) => normalizeStatus(item.status) === 'approved').length;
    const rejections = group.length - approvals;
    if (!approvals || !rejections) return;
    const majorityOutcome = approvals >= rejections ? 'approved' : 'rejected';

    group.forEach((request) => {
      const actualOutcome = normalizeStatus(request.status);
      const decisionEvent = (request.auditTrail || []).find((event) =>
        ['manager_approved', 'manager_rejected', 'admin_approved', 'admin_rejected'].includes(event.action)
      );
      const inconsistent = actualOutcome !== majorityOutcome;
      similarRequestComparisons.push({
        requestId: request.id,
        title: request.title,
        department: request.department || 'General',
        type: request.type || 'General',
        amount: Number(request.amount || 0),
        baselineOutcome: majorityOutcome,
        actualOutcome,
        approver: decisionEvent?.actorName || 'Unknown',
        inconsistent,
      });
      if (inconsistent) {
        auditTrail.push({
          id: `fair-${request.id}`,
          requestId: request.id,
          actor: decisionEvent?.actorName || 'Unknown',
          action: 'decision_inconsistency_flagged',
          reason: 'Decision differs from majority outcome for similar historical requests.',
          timestamp: new Date().toISOString(),
        });
      }
    });
  });

  const approverStats = getApproverStats(decided);
  const globalRejectionRate =
    approverStats.reduce((sum, row) => sum + row.rejected, 0) /
      Math.max(1, approverStats.reduce((sum, row) => sum + row.reviewed, 0)) || 0;

  const approverConsistency = approverStats.map((row) => {
    const deviation = Math.abs(row.rejectionRate - globalRejectionRate);
    return {
      approverId: row.approverId,
      approver: row.approverName,
      reviewed: row.reviewed,
      rejectionRate: Number((row.rejectionRate * 100).toFixed(1)),
      consistencyScore: Number(clamp(100 - deviation * 140 - (row.reviewed < 5 ? 10 : 0), 20, 100).toFixed(1)),
      deviationScore: Number((deviation * 100).toFixed(1)),
    };
  });

  const inconsistentCount = similarRequestComparisons.filter((item) => item.inconsistent).length;
  const inconsistentDecisionRate = Number((inconsistentCount / Math.max(1, similarRequestComparisons.length)).toFixed(3));
  const consistencyPenalty = avg(approverConsistency.map((item) => 100 - item.consistencyScore));
  const fairnessScore = Number(
    clamp(100 - inconsistentDecisionRate * 100 * 0.65 - consistencyPenalty * 0.35, 8, 100).toFixed(1)
  );

  const alerts = [];
  if (fairnessScore < 70) {
    alerts.push({
      severity: fairnessScore < 55 ? 'critical' : 'warning',
      title: 'Fairness drift detected',
      message: 'Decision consistency for similar requests has dropped below target baseline.',
    });
  }
  if (inconsistentCount > 0) {
    alerts.push({
      severity: 'warning',
      title: 'Inconsistent decisions found',
      message: `${inconsistentCount} request(s) differ from similar historical outcomes.`,
    });
  }

  return {
    fairnessScore,
    inconsistentDecisionRate,
    alerts,
    approverConsistency,
    similarRequestComparisons: similarRequestComparisons.slice(0, 120),
    auditTrail: auditTrail.slice(0, 120),
  };
};

const defaultStageTemplate = [
  { id: 'submission_validation', label: 'Submission Validation', avgHours: 3, capacityPerDay: 60, automationScore: 0.6 },
  { id: 'manager_review', label: 'Manager Review', avgHours: 16, capacityPerDay: 28, automationScore: 0.35 },
  { id: 'admin_review', label: 'Admin Review', avgHours: 14, capacityPerDay: 22, automationScore: 0.25 },
  { id: 'compliance_check', label: 'Compliance Check', avgHours: 8, capacityPerDay: 30, automationScore: 0.45 },
  { id: 'finalization', label: 'Finalization', avgHours: 4, capacityPerDay: 50, automationScore: 0.55 },
];

const simulateDigitalTwin = (payload = {}) => {
  const history = getRequestHistory();
  const stageMap = (Array.isArray(payload.stageMap) && payload.stageMap.length ? payload.stageMap : defaultStageTemplate).map(
    (stage, index) => ({
      id: stage.id || `stage_${index + 1}`,
      label: stage.label || stage.name || `Stage ${index + 1}`,
      avgHours: Number(Math.max(0.5, toNumber(stage.avgHours, 8)).toFixed(2)),
      capacityPerDay: Number(Math.max(1, toNumber(stage.capacityPerDay, 20)).toFixed(2)),
      automationScore: Number(clamp(toNumber(stage.automationScore, 0.4), 0, 1).toFixed(2)),
    })
  );

  const horizonDays = Number(clamp(toNumber(payload.horizonDays, 14), 1, 60).toFixed(0));
  const recentVolume = history.filter((item) => hoursBetween(resolveSubmittedAt(item), new Date().toISOString()) <= 24 * 14).length;
  const incomingVolumePerDay = Number(
    clamp(toNumber(payload.incomingVolumePerDay, recentVolume ? recentVolume / 14 : 10), 1, 500).toFixed(2)
  );

  let inflow = incomingVolumePerDay * horizonDays;
  const stageBreakdown = stageMap.map((stage) => {
    const serviceCapacity = stage.capacityPerDay * horizonDays * (0.65 + stage.automationScore * 0.7);
    const utilization = Number((inflow / Math.max(1, serviceCapacity)).toFixed(3));
    const queueDelayHours = Number((Math.max(0, utilization - 1) * stage.avgHours * 2.2).toFixed(2));
    const stageTimeHours = Number((stage.avgHours + queueDelayHours).toFixed(2));
    const throughput = Number(Math.min(inflow, serviceCapacity).toFixed(2));
    inflow = throughput;
    return {
      stageId: stage.id,
      stageLabel: stage.label,
      avgHours: stage.avgHours,
      queueDelayHours,
      stageTimeHours,
      utilization,
      serviceCapacity: Number(serviceCapacity.toFixed(2)),
      throughput,
      automationScore: stage.automationScore,
    };
  });

  const bottleneck = [...stageBreakdown].sort((a, b) => b.utilization - a.utilization)[0];
  const averageApprovalHours = Number(stageBreakdown.reduce((sum, stage) => sum + stage.stageTimeHours, 0).toFixed(2));
  const queueLoadRisk = Number(clamp(avg(stageBreakdown.map((stage) => stage.utilization)) / 1.2, 0.05, 0.99).toFixed(3));

  const recommendations = [];
  if (bottleneck?.utilization >= 1) recommendations.push(`Increase capacity in ${bottleneck.stageLabel} to reduce queue spillover.`);
  if (stageBreakdown.some((stage) => stage.automationScore < 0.35)) recommendations.push('Automate low-scoring stages with template-driven validation or rules.');
  if (queueLoadRisk > 0.7) recommendations.push('Enable adaptive rerouting and escalation to avoid SLA breaches.');
  if (!recommendations.length) recommendations.push('Digital twin indicates stable flow under current operating assumptions.');

  return {
    averageApprovalHours,
    predictedBottleneckStage: bottleneck?.stageLabel || 'Unknown',
    queueLoadRisk,
    stageBreakdown,
    recommendations,
    assumptions: { incomingVolumePerDay, horizonDays },
  };
};

const runSimulation = ({ department = 'Operations', amount = 5000, priority = 'medium', historicalRequests = null }) => {
  const requests = historicalRequests || getRequestHistory();
  const baseline = requests.filter((item) => (item.department || 'General') === department);
  const baseCycle = avg(baseline.map((item) => getStageDurations(item).endToEnd).filter((value) => value > 0)) || 24;
  const amountPenalty = Math.min(48, Number(amount) / 1500);
  const normalizedPriority = String(priority || 'medium').toLowerCase();
  const priorityPenalty = normalizedPriority === 'high' ? 18 : normalizedPriority === 'medium' ? 8 : 2;
  const estimatedApprovalHours = Number((baseCycle + amountPenalty + priorityPenalty).toFixed(1));

  let predictedBottleneck = 'Manager review queue';
  if (amount > 15000) predictedBottleneck = 'Admin approval threshold';
  if (department === 'Finance') predictedBottleneck = 'Compliance validation';

  return {
    estimatedApprovalHours,
    estimatedApprovalDays: Number((estimatedApprovalHours / 24).toFixed(2)),
    predictedBottleneck,
    delayProbability: Number(clamp(estimatedApprovalHours / 72, 0.05, 0.98).toFixed(2)),
  };
};

const buildSmartPulse = (requests) => {
  const friction = computeFrictionIntelligence(requests);
  const load = computeLoadMeter(requests);
  const fairness = computeFairnessIndex(requests);
  const delayProbability = Number(clamp((100 - friction.workflowHealthScore + load.loadPercent * 0.6) / 100, 0.05, 0.98).toFixed(2));
  const suggestions = [];
  if (load.overload) suggestions.push('Enable pattern-based escalation for overloaded queues.');
  if (fairness.fairnessScore < 65) suggestions.push('Redistribute manager assignments to improve fairness.');
  if (friction.workflowHealthScore < 70) suggestions.push('Introduce pre-validation checklist to reduce rework.');
  if (!suggestions.length) suggestions.push('Workflow is stable. Continue monitoring SmartPulse signals.');
  return {
    delayProbability,
    healthScore: friction.workflowHealthScore,
    suggestions,
  };
};

const getIntelligenceSnapshot = () => {
  const cached = getCache('intelligence_snapshot');
  if (cached) return cached;

  const requests = getRequestHistory();
  const friction = computeFrictionIntelligence(requests);
  const decisionPatterns = computeDecisionPatterns(requests);
  const risk = computeRiskScoring(requests);
  const load = computeLoadMeter(requests);
  const fairness = computeFairnessIndex(requests);
  const smartEscalation = suggestFastestResolvers(requests);
  const smartPulse = buildSmartPulse(requests);
  const departments = [...new Set(requests.map((item) => item.department || 'General'))];
  const processDna = departments.map((department) => getProcessDnaByDepartment(department, requests));
  const adaptiveRerouting = getAdaptiveWorkflowInsights();
  const fairnessDiagnostics = getFairnessDiagnostics();

  const snapshot = {
    generatedAt: new Date().toISOString(),
    smartPulse,
    friction,
    decisionPatterns,
    risk,
    load,
    fairness,
    smartEscalation,
    processDna,
    adaptiveRerouting,
    fairnessDiagnostics,
  };

  setCache('intelligence_snapshot', snapshot);
  return snapshot;
};

const getProcessDnaReportLines = (department) => {
  const report = getProcessDnaByDepartment(department);
  return [
    `Department: ${report.department}`,
    `Requests Analyzed: ${report.requestCount}`,
    `Delay Factor (avg hours): ${report.delayFactor}`,
    `Risk Ratio (% high risk): ${report.riskRatio}`,
    `Efficiency Score: ${report.efficiencyScore}`,
    `Bottleneck Summary: ${report.bottleneckSummary}`,
    `Generated At: ${new Date().toISOString()}`,
  ];
};

module.exports = {
  getIntelligenceSnapshot,
  predictApprovalOutcome,
  getAdaptiveWorkflowInsights,
  rerouteRequest,
  monitorWorkflowAndEscalate,
  getFairnessDiagnostics,
  simulateDigitalTwin,
  runSimulation,
  getProcessDnaByDepartment,
  getProcessDnaReportLines,
  invalidateCache,
};

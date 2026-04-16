const { listRequests, users } = require('../data/mockStore');

const toMs = (value) => {
  const ts = new Date(value || 0).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

const hoursBetween = (start, end) => {
  const startMs = toMs(start);
  const endMs = toMs(end);
  if (!startMs || !endMs || endMs <= startMs) return 0;
  return (endMs - startMs) / (1000 * 60 * 60);
};

const avg = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const normalizeStatus = (status) => String(status || '').toLowerCase();

const resolveSubmittedAt = (request) => request.createdAt || request.submittedAt || request.updatedAt || null;

const resolveDecisionAt = (request) => {
  const timelineDecision = (request.timeline || []).find((item) =>
    ['approved', 'rejected'].includes(normalizeStatus(item.status))
  );
  if (timelineDecision?.timestamp) return timelineDecision.timestamp;

  const auditDecision = (request.auditTrail || []).find((item) =>
    ['manager_approved', 'manager_rejected', 'admin_approved', 'admin_rejected'].includes(item.action)
  );
  return auditDecision?.timestamp || request.updatedAt || null;
};

const resolveFirstApproverActionAt = (request) => {
  const action = (request.auditTrail || []).find((item) =>
    ['manager_approved', 'manager_rejected', 'admin_approved', 'admin_rejected'].includes(item.action)
  );
  return action?.timestamp || null;
};

const getRequestHistory = () => listRequests();

const buildDepartmentBuckets = (requests = getRequestHistory()) => {
  const buckets = {};
  requests.forEach((request) => {
    const department = request.department || 'General';
    if (!buckets[department]) {
      buckets[department] = {
        total: 0,
        approved: 0,
        rejected: 0,
        cycleHours: [],
      };
    }

    const bucket = buckets[department];
    bucket.total += 1;
    const status = normalizeStatus(request.status);
    if (status === 'approved') bucket.approved += 1;
    if (status === 'rejected') bucket.rejected += 1;

    const cycleHours = hoursBetween(resolveSubmittedAt(request), resolveDecisionAt(request));
    if (cycleHours > 0) bucket.cycleHours.push(cycleHours);
  });
  return buckets;
};

const getApproverStats = (requests = getRequestHistory()) => {
  const approverStats = {};

  requests.forEach((request) => {
    (request.auditTrail || []).forEach((event) => {
      if (!['manager_approved', 'manager_rejected', 'admin_approved', 'admin_rejected'].includes(event.action)) {
        return;
      }

      const approverId = event.actorId || 'unknown';
      const approverName = event.actorName || 'Unknown';

      if (!approverStats[approverId]) {
        approverStats[approverId] = {
          approverId,
          approverName,
          reviewed: 0,
          approved: 0,
          rejected: 0,
          reviewHours: [],
        };
      }

      const stat = approverStats[approverId];
      stat.reviewed += 1;
      if (event.action.endsWith('approved')) stat.approved += 1;
      if (event.action.endsWith('rejected')) stat.rejected += 1;

      const reviewHours = hoursBetween(resolveSubmittedAt(request), event.timestamp);
      if (reviewHours > 0) stat.reviewHours.push(reviewHours);
    });
  });

  return Object.values(approverStats).map((item) => ({
    ...item,
    avgReviewHours: Number(avg(item.reviewHours).toFixed(2)),
    rejectionRate: Number((item.rejected / Math.max(1, item.reviewed)).toFixed(3)),
  }));
};

const getApproverLoadSnapshot = (requests = getRequestHistory()) => {
  const openStatuses = new Set(['pending', 'admin_review']);
  const queueByApproverId = {};

  requests.forEach((request) => {
    const status = normalizeStatus(request.status);
    if (!openStatuses.has(status)) return;

    const approverId =
      request.assignedManagerId ||
      request.currentApproverId ||
      users.find((item) => item.role === 'manager')?.id ||
      'unassigned';

    if (!queueByApproverId[approverId]) {
      queueByApproverId[approverId] = {
        approverId,
        pendingCount: 0,
        staleCount: 0,
        oldestPendingHours: 0,
      };
    }

    const queue = queueByApproverId[approverId];
    queue.pendingCount += 1;

    const ageHours = hoursBetween(resolveSubmittedAt(request), new Date().toISOString());
    queue.oldestPendingHours = Math.max(queue.oldestPendingHours, ageHours);
    if (ageHours >= 24) queue.staleCount += 1;
  });

  return Object.values(queueByApproverId).map((item) => ({
    ...item,
    oldestPendingHours: Number(item.oldestPendingHours.toFixed(2)),
  }));
};

const findSimilarRequests = (requestLike, requests = getRequestHistory()) => {
  const amount = Number(requestLike?.amount || 0);
  const band = amount < 5000 ? 'low' : amount < 15000 ? 'mid' : 'high';

  return requests.filter((item) => {
    const itemAmount = Number(item.amount || 0);
    const itemBand = itemAmount < 5000 ? 'low' : itemAmount < 15000 ? 'mid' : 'high';

    return (
      String(item.department || '').toLowerCase() ===
        String(requestLike?.department || '').toLowerCase() &&
      String(item.type || '').toLowerCase() === String(requestLike?.type || '').toLowerCase() &&
      itemBand === band
    );
  });
};

module.exports = {
  avg,
  hoursBetween,
  normalizeStatus,
  resolveSubmittedAt,
  resolveDecisionAt,
  resolveFirstApproverActionAt,
  getRequestHistory,
  buildDepartmentBuckets,
  getApproverStats,
  getApproverLoadSnapshot,
  findSimilarRequests,
};
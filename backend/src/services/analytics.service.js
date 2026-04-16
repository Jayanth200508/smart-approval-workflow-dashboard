const { listRequests } = require('../data/mockStore');

const bucketByMonth = (requests) => {
  const map = requests.reduce((acc, item) => {
    const key = new Date(item.createdAt).toISOString().slice(0, 7);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(map)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([month, count]) => ({ month, count }));
};

const computeAverageApprovalTimeHours = (requests) => {
  const approved = requests.filter((item) => item.status === 'approved');
  if (!approved.length) return 0;

  const totalMs = approved.reduce((sum, request) => {
    const approvedEvent = [...request.timeline].reverse().find((event) => event.status === 'approved');
    if (!approvedEvent) return sum;
    return sum + (new Date(approvedEvent.timestamp) - new Date(request.createdAt));
  }, 0);

  return Number((totalMs / approved.length / (1000 * 60 * 60)).toFixed(2));
};

const managerLeaderboard = (requests) => {
  const board = {};
  requests.forEach((request) => {
    const action = (request.auditTrail || []).find(
      (event) => event.action === 'manager_approved' || event.action === 'manager_rejected'
    );
    if (!action) return;
    if (!board[action.actorName]) board[action.actorName] = { manager: action.actorName, handled: 0, avgHours: 0, totalMs: 0 };
    board[action.actorName].handled += 1;
    board[action.actorName].totalMs += new Date(action.timestamp) - new Date(request.createdAt);
  });
  return Object.values(board)
    .map((item) => ({
      manager: item.manager,
      handled: item.handled,
      averageReviewHours: Number((item.totalMs / item.handled / (1000 * 60 * 60)).toFixed(2)),
      efficiencyScore: Number(Math.max(0, 100 - item.totalMs / item.handled / (1000 * 60 * 60) * 7).toFixed(1)),
    }))
    .sort((a, b) => b.efficiencyScore - a.efficiencyScore);
};

const getAnalytics = () => {
  const requests = listRequests();
  const totalRequests = requests.length;
  const approvedCount = requests.filter((item) => item.status === 'approved').length;
  const rejectedCount = requests.filter((item) => item.status === 'rejected').length;
  const approvalPercentage = totalRequests ? Number(((approvedCount / totalRequests) * 100).toFixed(2)) : 0;
  const rejectionPercentage = totalRequests ? Number(((rejectedCount / totalRequests) * 100).toFixed(2)) : 0;
  const averageTimeToApproveHours = computeAverageApprovalTimeHours(requests);

  const departmentWiseCounts = requests.reduce((acc, item) => {
    if (!acc[item.department]) acc[item.department] = { total: 0, approved: 0, rejected: 0 };
    acc[item.department].total += 1;
    if (item.status === 'approved') acc[item.department].approved += 1;
    if (item.status === 'rejected') acc[item.department].rejected += 1;
    return acc;
  }, {});

  const departmentRanking = Object.entries(departmentWiseCounts)
    .map(([department, stats]) => ({
      department,
      total: stats.total,
      approvalRate: stats.total ? Number(((stats.approved / stats.total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.approvalRate - a.approvalRate);

  const monthlyTrends = bucketByMonth(requests);
  const leaderboard = managerLeaderboard(requests);

  return {
    totalRequests,
    approvalPercentage,
    rejectionPercentage,
    averageTimeToApproveHours,
    departmentWiseCounts,
    departmentRanking,
    monthlyTrends,
    managerLeaderboard: leaderboard,
    highestPriorityOpenItems: requests.filter(
      (item) => item.priority === 'high' && ['pending', 'admin_review'].includes(item.status)
    ).length,
    insight:
      departmentRanking.length > 0
        ? `Requests in ${departmentRanking[departmentRanking.length - 1].department} take longest; consider delegation.`
        : 'Not enough data to produce insight.',
  };
};

const getManagerAnalytics = () => {
  const requests = listRequests();
  const pending = requests.filter((item) => item.status === 'pending');
  const managerReviewed = requests.filter((request) =>
    (request.auditTrail || []).some((event) => event.action === 'manager_approved' || event.action === 'manager_rejected')
  );

  const managerReviewMs = managerReviewed.reduce((sum, request) => {
    const managerEvent = (request.auditTrail || []).find(
      (event) => event.action === 'manager_approved' || event.action === 'manager_rejected'
    );
    if (!managerEvent) return sum;
    return sum + (new Date(managerEvent.timestamp) - new Date(request.createdAt));
  }, 0);

  return {
    pendingApprovals: pending.length,
    averageManagerApprovalTimeHours: managerReviewed.length
      ? Number((managerReviewMs / managerReviewed.length / (1000 * 60 * 60)).toFixed(2))
      : 0,
    highestPriorityItems: pending.filter((item) => item.priority === 'high').length,
  };
};

module.exports = {
  getAnalytics,
  getManagerAnalytics,
};


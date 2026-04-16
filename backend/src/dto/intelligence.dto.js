const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toPredictionDto = (payload = {}) => {
  const approvalChance = Number(clamp(Number(payload.approvalChance || 0), 0, 100).toFixed(1));
  const confidenceScore = Number(clamp(Number(payload.confidenceScore || 0), 0, 100).toFixed(1));
  const estimatedApprovalHours = Number(Math.max(0, Number(payload.estimatedApprovalHours || 0)).toFixed(2));

  return {
    generatedAt: new Date().toISOString(),
    approvalChance,
    rejectionChance: Number((100 - approvalChance).toFixed(1)),
    estimatedApprovalHours,
    estimatedApprovalDays: Number((estimatedApprovalHours / 24).toFixed(2)),
    confidenceScore,
    bottleneckRisk: payload.bottleneckRisk || 'Low',
    bottleneckSignals: Array.isArray(payload.bottleneckSignals) ? payload.bottleneckSignals : [],
    missingFields: Array.isArray(payload.missingFields) ? payload.missingFields : [],
    suggestedDocuments: Array.isArray(payload.suggestedDocuments) ? payload.suggestedDocuments : [],
    recommendations: Array.isArray(payload.recommendations) ? payload.recommendations : [],
  };
};

const toBottleneckDto = (payload = {}) => ({
  generatedAt: new Date().toISOString(),
  overloadedApprovers: payload.overloadedApprovers || [],
  inactiveApprovers: payload.inactiveApprovers || [],
  staleRequests: payload.staleRequests || [],
  escalationAlerts: payload.escalationAlerts || [],
  suggestedReroutes: payload.suggestedReroutes || [],
  realtimeStatus: payload.realtimeStatus || {
    queueHealth: 'healthy',
    openQueue: 0,
    overloadRatio: 0,
    avgPendingHours: 0,
  },
});

const toFairnessDto = (payload = {}) => ({
  generatedAt: new Date().toISOString(),
  fairnessScore: Number(clamp(Number(payload.fairnessScore || 0), 0, 100).toFixed(1)),
  inconsistentDecisionRate: Number(clamp(Number(payload.inconsistentDecisionRate || 0), 0, 1).toFixed(3)),
  alerts: payload.alerts || [],
  approverConsistency: payload.approverConsistency || [],
  similarRequestComparisons: payload.similarRequestComparisons || [],
  auditTrail: payload.auditTrail || [],
});

const toDigitalTwinDto = (payload = {}) => ({
  generatedAt: new Date().toISOString(),
  averageApprovalHours: Number(Math.max(0, Number(payload.averageApprovalHours || 0)).toFixed(2)),
  predictedBottleneckStage: payload.predictedBottleneckStage || 'Unknown',
  queueLoadRisk: Number(clamp(Number(payload.queueLoadRisk || 0), 0, 1).toFixed(3)),
  stageBreakdown: payload.stageBreakdown || [],
  recommendations: payload.recommendations || [],
});

module.exports = {
  toPredictionDto,
  toBottleneckDto,
  toFairnessDto,
  toDigitalTwinDto,
};
import { ENABLE_BACKEND, callApi, isNetworkError } from "./httpClient";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const avg = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const toMs = (value) => {
  const time = new Date(value || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const hoursBetween = (start, end) => {
  const from = toMs(start);
  const to = toMs(end);
  if (!from || !to || to <= from) return 0;
  return (to - from) / (1000 * 60 * 60);
};

export const buildAutoRequestSummary = ({
  requestTitle,
  requestCategory,
  description,
}) => {
  const title = String(requestTitle || "").trim();
  const category = String(requestCategory || "General");
  const cleanDescription = String(description || "").replace(/\s+/g, " ").trim();
  const durationMatch = `${title} ${cleanDescription}`.match(
    /(\d+)\s*(day|days|hour|hours|week|weeks)/i,
  );
  const duration = durationMatch
    ? `${durationMatch[1]} ${durationMatch[2].toLowerCase()}`
    : "";
  const reason = cleanDescription
    ? cleanDescription.split(" ").slice(0, 10).join(" ")
    : "general business requirement";
  if (duration) return `${category} request for ${duration} due to ${reason}.`;
  if (title) return `${category} request: ${title}. Reason: ${reason}.`;
  return `${category} request generated for ${reason}.`;
};

const computeFallbackPrediction = (request) => {
  const missingDocs = [];
  const attachmentCount = Array.isArray(request?.attachments)
    ? request.attachments.length
    : 0;
  if (!request?.description || String(request.description).trim().length < 20) {
    missingDocs.push("Detailed business context");
  }
  if (Number(request?.amount || 0) >= 10000 && attachmentCount === 0) {
    missingDocs.push("Budget owner approval note");
  }
  if (
    String(request?.type || "").toLowerCase().includes("travel") &&
    attachmentCount === 0
  ) {
    missingDocs.push("Travel itinerary");
  }

  let risk = 20;
  risk += missingDocs.length * 16;
  risk += Number(request?.amount || 0) >= 20000 ? 18 : 0;
  risk += String(request?.priority || "").toLowerCase() === "high" ? 10 : 0;
  risk = Number(clamp(risk, 5, 95).toFixed(1));

  const delayHours = Number(
    clamp(18 + risk * 0.8 + missingDocs.length * 4, 8, 192).toFixed(1),
  );
  const completionDate = new Date(Date.now() + delayHours * 60 * 60 * 1000);

  return {
    requestId: request?.id || "",
    aiRiskScore: risk,
    riskLevel: risk >= 70 ? "High" : risk >= 40 ? "Medium" : "Low",
    predictedDelayHours: delayHours,
    predictedDelay: delayHours,
    predictedCompletionDate: completionDate.toISOString(),
    requiredDocuments: [],
    missingDocuments: missingDocs,
    smartRouteRecommendation: [],
    bottleneckWarnings: [],
    aiSummary: buildAutoRequestSummary({
      requestTitle: request?.title,
      requestCategory: request?.type,
      description: request?.description,
    }),
    escalationHistory: [],
    warningMessage:
      risk >= 70 && missingDocs.length
        ? `This request has high chance of rejection because required document is missing: ${missingDocs.join(
            ", ",
          )}.`
        : "",
  };
};

const buildFallbackAnalytics = (requests = []) => {
  const rows = Array.isArray(requests) ? requests : [];
  const pending = rows.filter((item) =>
    ["pending", "pending manager approval", "pending admin approval"].includes(
      String(item.status || "").toLowerCase(),
    ),
  );
  const decided = rows.filter((item) =>
    ["approved", "rejected"].includes(String(item.status || "").toLowerCase()),
  );
  const approved = decided.filter(
    (item) => String(item.status || "").toLowerCase() === "approved",
  );
  const averageApprovalTimeHours = Number(
    avg(
      decided
        .map((item) =>
          hoursBetween(item.submittedAt || item.createdAt, item.decidedAt || item.lastUpdated),
        )
        .filter(Boolean),
    ).toFixed(2),
  );
  const approvalSuccessRate = decided.length
    ? Number(((approved.length / decided.length) * 100).toFixed(1))
    : 0;

  const departmentMap = {};
  rows.forEach((item) => {
    const key = item.department || "General";
    if (!departmentMap[key]) {
      departmentMap[key] = {
        department: key,
        total: 0,
        approved: 0,
        durations: [],
        pending: [],
      };
    }
    departmentMap[key].total += 1;
    if (String(item.status || "").toLowerCase() === "approved") {
      departmentMap[key].approved += 1;
    }
    const duration = hoursBetween(
      item.submittedAt || item.createdAt,
      item.decidedAt || item.lastUpdated,
    );
    if (duration > 0) departmentMap[key].durations.push(duration);
    if (
      ["pending", "pending manager approval", "pending admin approval"].includes(
        String(item.status || "").toLowerCase(),
      )
    ) {
      departmentMap[key].pending.push(
        hoursBetween(item.submittedAt || item.createdAt, new Date()),
      );
    }
  });

  const departmentWiseDelays = Object.values(departmentMap).map((row) => ({
    department: row.department,
    averageDelayHours: Number(avg(row.durations).toFixed(2)),
    averagePendingHours: Number(avg(row.pending).toFixed(2)),
    totalRequests: row.total,
    approvalSuccessRate: row.total
      ? Number(((row.approved / row.total) * 100).toFixed(1))
      : 0,
  }));

  const bottleneckHeatmap = pending
    .map((item) => ({
      requestId: item.id,
      title: item.title,
      department: item.department || "General",
      approverName: item.approverName || "Unassigned",
      pendingHours: Number(
        hoursBetween(item.submittedAt || item.createdAt, new Date()).toFixed(2),
      ),
      predictedDelayHours: Number(item.predictedDelay || 24),
      riskLevel: item.riskLevel || "Medium",
      isStuck:
        hoursBetween(item.submittedAt || item.createdAt, new Date()) >
        Number(item.predictedDelay || 24),
    }))
    .sort((a, b) => b.pendingHours - a.pendingHours);

  const requestTrendsMap = {};
  const now = new Date();
  for (let i = 13; i >= 0; i -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    requestTrendsMap[day.toISOString().slice(0, 10)] = 0;
  }
  rows.forEach((item) => {
    const key = new Date(item.submittedAt || item.createdAt || new Date())
      .toISOString()
      .slice(0, 10);
    if (Object.prototype.hasOwnProperty.call(requestTrendsMap, key)) {
      requestTrendsMap[key] += 1;
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    totalRequests: rows.length,
    averageApprovalTimeHours,
    approvalSuccessRate,
    pendingCount: pending.length,
    departmentWiseDelays,
    bottleneckHeatmap,
    stuckRequests: bottleneckHeatmap.filter((item) => item.isStuck).slice(0, 10),
    slowApprovers: [],
    bottleneckWarnings: bottleneckHeatmap
      .filter((item) => item.pendingHours >= 36)
      .slice(0, 5)
      .map(
        (item) =>
          `${item.department} request "${item.title}" has been pending for ${item.pendingHours.toFixed(1)}h.`,
      ),
    requestTrends: Object.entries(requestTrendsMap).map(([date, count]) => ({
      date,
      count,
    })),
    escalations: {
      total: 0,
      open: 0,
      autoEscalated: 0,
      recent: [],
    },
    cards: {
      averageApprovalTimeHours,
      approvalSuccessRate,
      delayedRequests: bottleneckHeatmap.filter((item) => item.isStuck).length,
      activeEscalations: 0,
    },
  };
};

export const createAiEnhancedRequest = async (payload) =>
  callApi("/requests/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getAiPredictionByRequestId = async (requestId, requests = []) => {
  try {
    return await callApi(`/requests/prediction/${requestId}`);
  } catch (error) {
    if (ENABLE_BACKEND && !isNetworkError(error)) throw error;
    const match = (requests || []).find((item) => String(item.id) === String(requestId));
    return computeFallbackPrediction(match || {});
  }
};

export const escalateAiRequest = async (requestId, reason = "") =>
  callApi(`/escalate/${requestId}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

export const getAiDashboardAnalytics = async (requests = []) => {
  try {
    return await callApi("/analytics/dashboard");
  } catch (error) {
    if (ENABLE_BACKEND && !isNetworkError(error)) throw error;
    return buildFallbackAnalytics(requests);
  }
};

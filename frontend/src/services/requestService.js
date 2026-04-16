import { ENABLE_BACKEND, callApi, isNetworkError } from "./httpClient";
import { getRequests, initMockStore, setRequests } from "./mockStore";
import { createAiEnhancedRequest } from "./aiWorkflowService";
import {
  getDefaultDueAt,
  getDeadlineMeta,
  isOverdue,
} from "../utils/requestInsights";
import {
  addActivityLog,
  addNotification,
  addRequestEvent,
  listUsers,
  listRequestEvents,
} from "./workflowService";

const toTitleCase = (value = "") =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

const STATUS_LABELS = {
  pending: "Pending Manager Approval",
  manager_review: "Manager Review",
  admin_review: "Pending Admin Approval",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Cancelled",
};

const sortBySubmittedDesc = (data) =>
  [...data].sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );

const toStats = (rows) => ({
  total: rows.length,
  pending: rows.filter((item) =>
    ["Pending", "Pending Manager Approval", "Pending Admin Approval"].includes(
      item.status,
    ),
  ).length,
  approved: rows.filter((item) => item.status === "Approved").length,
  rejected: rows.filter((item) => item.status === "Rejected").length,
});

const fromBackendRequest = (request) => ({
  id: request.id || request._id,
  title: request.title,
  type: request.type || "General",
  department: request.department || "General",
  requesterId: request.requesterId || "n/a",
  requesterName: request.requesterName || "Unknown",
  amount: Number(request.amount || 0),
  priority: toTitleCase(request.priority || "medium"),
  urgency: request.urgency || "normal",
  status:
    STATUS_LABELS[String(request.status || "").toLowerCase()] ||
    toTitleCase(String(request.status || "pending").replaceAll("_", " ")),
  submittedAt:
    request.createdAt || request.submittedAt || new Date().toISOString(),
  decidedAt: request.decidedAt || "",
  approvalTimeMinutes: Number(request.approvalTimeMinutes || 0),
  lastUpdated:
    request.updatedAt || request.createdAt || new Date().toISOString(),
  approverName: request.approverName || "",
  description: request.description || "",
  decisionComment: request.comment || request.decisionComment || "",
  timeline: request.timeline || listRequestEvents(request.id || request._id),
  auditTrail: request.auditTrail || [],
  attachments: request.attachments || [],
  slaProgress: Number(request.slaProgress || 0),
  approvalProbability: request.approvalProbability,
  delayPredictionDays: request.delayPredictionDays,
  aiRiskScore: Number(request.aiRiskScore || 0),
  riskLevel: request.riskLevel || "Low",
  predictedDelayHours: Number(
    request.predictedDelayHours || request.predictedDelay || 0,
  ),
  predictedCompletionDate: request.predictedCompletionDate || "",
  aiSummary: request.aiSummary || "",
  missingDocuments: request.missingDocuments || [],
  requiredDocuments: request.requiredDocuments || [],
  smartRouteRecommendation: request.smartRouteRecommendation || [],
  bottleneckWarnings: request.bottleneckWarnings || [],
  escalationCount: Number(request.escalationCount || 0),
  lastEscalatedAt: request.lastEscalatedAt || "",
  legacyRequestId: request.legacyRequestId || "",
  dueAt:
    request.dueAt ||
    getDefaultDueAt({
      priority: toTitleCase(request.priority || "medium"),
      submittedAt: request.createdAt || request.submittedAt,
    }),
});

const enrichRequestMeta = (request) => {
  const dueAt =
    request.dueAt ||
    getDefaultDueAt({
      priority: request.priority,
      submittedAt: request.submittedAt,
    });
  const enriched = {
    ...request,
    dueAt,
  };
  return {
    ...enriched,
    isOverdue: isOverdue(enriched),
    deadlineMeta: getDeadlineMeta(enriched),
  };
};

const loadMockRequests = () => {
  initMockStore();
  return sortBySubmittedDesc(
    getRequests().map((item) => ({
      ...item,
      timeline: listRequestEvents(item.id),
    })).map(enrichRequestMeta),
  );
};

const saveMockRequests = (rows) => setRequests(sortBySubmittedDesc(rows));

const listDepartmentManagers = (department) =>
  listUsers().filter(
    (item) => item.role === "manager" && item.department === department,
  );

export const getAllRequests = async () => {
  try {
    const response = await callApi("/requests");
    const rows = sortBySubmittedDesc(
      (Array.isArray(response) ? response : []).map(fromBackendRequest).map(enrichRequestMeta),
    );
    // If backend is enabled but currently returns empty, surface previously stored local data
    // so users can still access their historical UI records.
    if (ENABLE_BACKEND && rows.length === 0) {
      const legacyRows = loadMockRequests();
      if (legacyRows.length) return legacyRows;
    }
    return rows;
  } catch (error) {
    if (ENABLE_BACKEND && !isNetworkError(error)) throw error;
    return loadMockRequests();
  }
};

export const getRequestStats = async () => {
  try {
    const analytics = await callApi("/analytics/manager");
    const stats = {
      total: analytics.pendingApprovals || 0,
      pending: analytics.pendingApprovals || 0,
      approved: 0,
      rejected: 0,
    };
    if (ENABLE_BACKEND && stats.total === 0) {
      const legacyRows = loadMockRequests();
      if (legacyRows.length) return toStats(legacyRows);
    }
    return stats;
  } catch (error) {
    if (ENABLE_BACKEND && !isNetworkError(error)) throw error;
    return toStats(loadMockRequests());
  }
};

export const createNewRequest = async (payload) => {
  const requestPayload = {
    title: payload.title,
    type: payload.type || "General",
    department: payload.department,
    amount: Number(payload.amount || 0),
    priority: String(payload.priority || "medium").toLowerCase(),
    urgency: payload.urgent ? "urgent" : "normal",
    description: payload.description,
    attachments: payload.attachment ? [payload.attachment.name] : [],
    dueAt: payload.expectedDate
      ? new Date(`${payload.expectedDate}T18:00:00.000Z`).toISOString()
      : undefined,
  };

  try {
    let response;
    try {
      response = await createAiEnhancedRequest({
        title: requestPayload.title,
        description: requestPayload.description,
        department: requestPayload.department,
        priority: requestPayload.priority,
        type: requestPayload.type,
        amount: requestPayload.amount,
        attachments: requestPayload.attachments,
        urgency: requestPayload.urgency,
      });
    } catch {
      // Backward compatibility: fallback to legacy endpoint when AI route is unavailable.
      response = await callApi("/requests", {
        method: "POST",
        body: JSON.stringify(requestPayload),
      });
    }
    return fromBackendRequest(response);
  } catch (error) {
    if (ENABLE_BACKEND && !isNetworkError(error)) throw error;
    const mockRequests = loadMockRequests();
    const created = {
      id: `REQ${Date.now().toString().slice(-6)}`,
      ...requestPayload,
      requesterName: payload.requesterName,
      requesterId: payload.requesterId,
      status: "Pending Manager Approval",
      submittedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      approverName: "",
      decisionComment: "",
      timeline: [],
      auditTrail: [],
      slaProgress: 0,
      dueAt:
        requestPayload.dueAt ||
        getDefaultDueAt({
          priority: requestPayload.priority,
          submittedAt: new Date().toISOString(),
        }),
    };
    addRequestEvent({
      requestId: created.id,
      action: "request_submitted",
      actorName: payload.requesterName,
      actorRole: "employee",
      status: "Pending Manager Approval",
      comment: "Request Submitted",
    });
    addActivityLog({
      userName: payload.requesterName,
      role: "employee",
      action: "Request submitted",
      requestId: created.id,
      status: "Pending Manager Approval",
    });
    listDepartmentManagers(created.department).forEach((manager) => {
      addNotification({
        userId: manager.id,
        title: "New department request",
        message: `${created.title} requires manager review.`,
        tone: "warning",
        requestId: created.id,
      });
    });
    saveMockRequests([created, ...mockRequests]);
    return enrichRequestMeta(created);
  }
};

export const updateUserRequest = async (id, payload, actorName) => {
  try {
    const response = await callApi(`/requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: payload.title,
        description: payload.description,
        department: payload.department,
        priority: String(payload.priority || "").toLowerCase(),
      }),
    });
    return fromBackendRequest(response);
  } catch (error) {
    if (ENABLE_BACKEND && !isNetworkError(error)) throw error;
    const rows = loadMockRequests().map((item) =>
      item.id === id
        ? {
            ...item,
            title: payload.title ?? item.title,
            description: payload.description ?? item.description,
            department: payload.department ?? item.department,
            priority: payload.priority ?? item.priority,
            lastUpdated: new Date().toISOString(),
            dueAt:
              payload.expectedDate
                ? new Date(`${payload.expectedDate}T18:00:00.000Z`).toISOString()
                : item.dueAt,
          }
        : item,
    );
    const request = rows.find((item) => item.id === id);
    if (!request) throw new Error("Request not found");
    if (
      !["Pending", "Pending Manager Approval", "Pending Admin Approval"].includes(
        request.status,
      )
    )
      throw new Error("Only pending requests can be edited.");

    addRequestEvent({
      requestId: id,
      action: "request_updated",
      actorName: actorName || request.requesterName || "Employee",
      actorRole: "employee",
      status: "Pending",
      comment: payload.comment || "Request updated by requester",
    });
    addActivityLog({
      userName: actorName || request.requesterName || "Employee",
      role: "employee",
      action: "Request updated",
      requestId: id,
      status: "Pending",
    });
    saveMockRequests(rows);
    return enrichRequestMeta(request);
  }
};

export const updateRequestDecision = async (
  id,
  payload,
  actorRole,
  actorName,
) => {
  try {
    const approve = payload.status === "Approved";
    const path =
      actorRole === "admin"
        ? `/requests/${id}/${approve ? "admin-approve" : "admin-reject"}`
        : `/requests/${id}/${approve ? "manager-approve" : "manager-reject"}`;
    const response = await callApi(path, {
      method: "PATCH",
      body: JSON.stringify({
        comment: payload.comment || "",
        confirmationToken: payload.confirmationToken || "",
      }),
    });
    return fromBackendRequest(response);
  } catch (error) {
    if (ENABLE_BACKEND && !isNetworkError(error)) throw error;
    if (!payload.comment?.trim()) {
      throw new Error("A reason is required for approval actions.");
    }
    const nowIso = new Date().toISOString();
    const rows = loadMockRequests().map((item) => {
      if (item.id !== id) return item;
      const base = {
        ...item,
        status: payload.status,
        approverName: actorName || payload.approverName || item.approverName,
        decisionComment: payload.comment || item.decisionComment || "",
        lastUpdated: nowIso,
      };
      if (payload.status === "Pending Admin Approval") {
        return {
          ...base,
          decidedAt: item.decidedAt || "",
          approvalTimeMinutes: Number(item.approvalTimeMinutes || 0),
        };
      }
      return {
        ...base,
        decidedAt: nowIso,
        approvalTimeMinutes: Math.max(
          0,
          Math.round(
            (new Date(nowIso).getTime() - new Date(item.submittedAt).getTime()) /
              (1000 * 60),
          ),
        ),
      };
    });
    const request = rows.find((item) => item.id === id);
    const action =
      payload.status === "Approved"
        ? "request_approved"
        : payload.status === "Rejected"
          ? "request_rejected"
          : "request_escalated";
    addRequestEvent({
      requestId: id,
      action,
      actorName: actorName || payload.approverName || "Approver",
      actorRole: actorRole || "employee",
      status: payload.status,
      comment: payload.comment,
    });
    addActivityLog({
      userName: actorName || payload.approverName || "Approver",
      role: actorRole || "employee",
      action:
        payload.status === "Approved"
          ? "Request approved"
          : payload.status === "Rejected"
            ? "Request rejected"
            : "Request escalated to admin",
      requestId: id,
      status: payload.status,
    });
    if (request) {
      if (payload.status === "Pending Admin Approval") {
        listUsers()
          .filter((item) => item.role === "admin")
          .forEach((admin) => {
            addNotification({
              userId: admin.id,
              title: "Escalated request awaiting admin approval",
              message: `${request.title} was escalated by manager.`,
              tone: "warning",
              requestId: request.id,
            });
          });
        addNotification({
          userId: request.requesterId,
          title: "Request escalated to admin",
          message: payload.comment.trim(),
          tone: "warning",
          requestId: request.id,
        });
      } else {
        addNotification({
          userId: request.requesterId,
          title: `Request ${payload.status}`,
          message: `${request.title} was ${payload.status.toLowerCase()}.`,
          tone: payload.status === "Approved" ? "success" : "error",
          requestId: request.id,
        });
        addNotification({
          userId: request.requesterId,
          title: "Approver comment added",
          message: payload.comment.trim(),
          tone: "warning",
          requestId: request.id,
        });
      }
    }
    saveMockRequests(rows);
    return request ? enrichRequestMeta(request) : request;
  }
};

export const runPendingEscalationSweep = async () => {
  if (ENABLE_BACKEND) return;
  const now = Date.now();
  const admins = listUsers().filter((item) => item.role === "admin");
  const rows = loadMockRequests();
  let changed = false;
  const nextRows = rows.map((item) => {
    if (
      !["Pending", "Pending Manager Approval", "Pending Admin Approval"].includes(
        item.status,
      )
    )
      return item;
    const submittedMs = new Date(item.submittedAt).getTime();
    const ageHours = (now - submittedMs) / (1000 * 60 * 60);
    const escalationCount = Number(item.escalationCount || 0);
    if (ageHours < 24 * (escalationCount + 1)) return item;
    changed = true;
    const nextEscalation = escalationCount + 1;
    admins.forEach((admin) => {
      addNotification({
        userId: admin.id,
        title: "Escalation: Pending request reminder",
        message: `${item.title} is still pending after ${24 * nextEscalation} hours.`,
        tone: "warning",
        requestId: item.id,
      });
    });
    addNotification({
      userId: item.requesterId,
      title: "Request pending for long time",
      message: `${item.title} is still pending. Approvers have been reminded.`,
      tone: "warning",
      requestId: item.id,
    });
    addActivityLog({
      userName: "Infosys Approval System",
      role: "system",
      action: "Pending request escalated",
      requestId: item.id,
      status: `Escalation ${nextEscalation}`,
    });
    return {
      ...item,
      escalationCount: nextEscalation,
      lastEscalationAt: new Date().toISOString(),
    };
  });
  if (changed) {
    saveMockRequests(nextRows);
  }
};

export const withdrawUserRequest = async (id, payload, actorName) => {
  try {
    const response = await callApi(`/requests/${id}/withdraw`, {
      method: "PATCH",
      body: JSON.stringify({
        comment: payload.comment || "",
      }),
    });
    return fromBackendRequest(response);
  } catch (error) {
    if (ENABLE_BACKEND && !isNetworkError(error)) throw error;
    const rows = loadMockRequests().map((item) =>
      item.id === id
        ? {
            ...item,
            status: "Cancelled",
            decisionComment: payload.comment || item.decisionComment || "",
            lastUpdated: new Date().toISOString(),
          }
        : item,
    );
    const request = rows.find((item) => item.id === id);
    if (!request) throw new Error("Request not found");
    addRequestEvent({
      requestId: id,
      action: "request_withdrawn",
      actorName: actorName || request.requesterName || "Employee",
      actorRole: "employee",
      status: "Cancelled",
      comment: payload.comment || "Request cancelled by requester",
    });
    addActivityLog({
      userName: actorName || request.requesterName || "Employee",
      role: "employee",
      action: "Request cancelled",
      requestId: id,
      status: "Cancelled",
    });
    saveMockRequests(rows);
    return request ? enrichRequestMeta(request) : request;
  }
};

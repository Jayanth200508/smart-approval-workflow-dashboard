const DAY_MS = 24 * 60 * 60 * 1000;

const PRIORITY_DEADLINE_DAYS = {
  Low: 5,
  Medium: 3,
  High: 2,
  Critical: 1,
  Urgent: 1,
};

const normalizePriority = (priority = "Medium") => {
  const value = String(priority || "Medium").toLowerCase();
  if (value === "critical") return "Critical";
  if (value === "urgent") return "Urgent";
  if (value === "high") return "High";
  if (value === "low") return "Low";
  return "Medium";
};

export const getDefaultDueAt = ({ priority, submittedAt }) => {
  const normalized = normalizePriority(priority);
  const days = PRIORITY_DEADLINE_DAYS[normalized] || PRIORITY_DEADLINE_DAYS.Medium;
  const base = submittedAt ? new Date(submittedAt).getTime() : Date.now();
  return new Date(base + days * DAY_MS).toISOString();
};

export const isOverdue = (request) => {
  if (!request?.dueAt) return false;
  return new Date(request.dueAt).getTime() < Date.now() && !["Approved", "Rejected", "Cancelled"].includes(request.status);
};

export const getDeadlineMeta = (request) => {
  if (!request?.dueAt) return { label: "No deadline", severity: "none", daysLeft: null };
  const diffMs = new Date(request.dueAt).getTime() - Date.now();
  const daysLeft = Math.ceil(diffMs / DAY_MS);
  if (daysLeft < 0) return { label: `Overdue by ${Math.abs(daysLeft)}d`, severity: "overdue", daysLeft };
  if (daysLeft <= 1) return { label: `Due in ${daysLeft}d`, severity: "critical", daysLeft };
  if (daysLeft <= 2) return { label: `Due in ${daysLeft}d`, severity: "warning", daysLeft };
  return { label: `Due in ${daysLeft}d`, severity: "normal", daysLeft };
};

export const getSmartApprovalSuggestion = (request) => {
  const probability = Number(request?.approvalProbability ?? 0);
  if (probability >= 0.75) {
    return { tone: "success", label: "Likely Approval", confidence: Math.round(probability * 100) };
  }
  if (probability >= 0.45) {
    return { tone: "warning", label: "Needs Review", confidence: Math.round(probability * 100) };
  }
  if (probability > 0) {
    return { tone: "danger", label: "High Rejection Risk", confidence: Math.round(probability * 100) };
  }

  const priority = normalizePriority(request?.priority);
  const status = String(request?.status || "");
  if (priority === "Critical" || priority === "Urgent") {
    return { tone: "warning", label: "Fast-Track Suggested", confidence: 62 };
  }
  if (status.includes("Admin")) {
    return { tone: "warning", label: "Senior Review Stage", confidence: 58 };
  }
  return { tone: "neutral", label: "Standard Flow", confidence: 50 };
};


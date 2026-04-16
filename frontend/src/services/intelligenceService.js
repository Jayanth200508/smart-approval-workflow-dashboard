import { callApi } from "./httpClient";
import { getUsers } from "./mockStore";

const LAYOUT_PREF_KEY = "flowpilot_intel_widget_usage";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const avg = (values) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
const stdDev = (values) => {
  if (!values.length) return 0;
  const mean = avg(values);
  return Math.sqrt(avg(values.map((value) => (value - mean) ** 2)));
};

const toMs = (value) => {
  const time = new Date(value || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const hoursBetween = (start, end) => {
  const startMs = toMs(start);
  const endMs = toMs(end);
  if (!startMs || !endMs || endMs <= startMs) return 0;
  return (endMs - startMs) / (1000 * 60 * 60);
};

const normalizeStatus = (status) => String(status || "").toLowerCase();
const resolveSubmitted = (request) =>
  request.submittedAt || request.createdAt || request.lastUpdated;
const resolveDecision = (request) =>
  (request.timeline || []).find((item) =>
    ["approved", "rejected"].includes(normalizeStatus(item.status)),
  )?.timestamp ||
  request.lastUpdated ||
  request.updatedAt;

const resolveManager = (request) =>
  (request.auditTrail || []).find((item) =>
    ["manager_approved", "manager_rejected"].includes(item.action),
  )?.timestamp || null;

const resolveAdmin = (request) =>
  (request.auditTrail || []).find((item) =>
    ["admin_approved", "admin_rejected"].includes(item.action),
  )?.timestamp || null;

const deriveRisk = (request, context) => {
  const amount = Number(request.amount || 0);
  const department = request.department || "General";
  const history = context[department] || {
    total: 0,
    rejected: 0,
    cycleHours: [],
  };
  const rejectRate = history.total ? history.rejected / history.total : 0;
  const cycle = hoursBetween(
    resolveSubmitted(request),
    resolveDecision(request),
  );
  const variance = Math.abs(cycle - avg(history.cycleHours || [0]));
  const raw =
    Math.min(42, amount / 500) + rejectRate * 30 + Math.min(20, variance * 1.2);
  const score = Number(clamp(raw, 0, 100).toFixed(1));
  return {
    score,
    level: score >= 67 ? "High" : score >= 34 ? "Medium" : "Low",
  };
};

const collectDepartmentContext = (requests) => {
  const map = {};
  requests.forEach((request) => {
    const department = request.department || "General";
    if (!map[department])
      map[department] = { total: 0, rejected: 0, cycleHours: [] };
    map[department].total += 1;
    if (normalizeStatus(request.status) === "rejected")
      map[department].rejected += 1;
    const cycle = hoursBetween(
      resolveSubmitted(request),
      resolveDecision(request),
    );
    if (cycle > 0) map[department].cycleHours.push(cycle);
  });
  return map;
};

const computeSnapshotFromRequests = (requests) => {
  const departments = {};
  const varianceBuckets = {
    submissionToManager: [],
    managerToAdmin: [],
    adminToDecision: [],
    endToEnd: [],
  };
  const behaviorMonthly = {};
  const approvers = {};
  const traffic = {};

  requests.forEach((request) => {
    const department = request.department || "General";
    if (!departments[department]) {
      departments[department] = {
        submissionToManager: [],
        managerToAdmin: [],
        adminToDecision: [],
        endToEnd: [],
      };
    }

    const stage = {
      submissionToManager: hoursBetween(
        resolveSubmitted(request),
        resolveManager(request),
      ),
      managerToAdmin: hoursBetween(
        resolveManager(request),
        resolveAdmin(request),
      ),
      adminToDecision: hoursBetween(
        resolveAdmin(request),
        resolveDecision(request),
      ),
      endToEnd: hoursBetween(
        resolveSubmitted(request),
        resolveDecision(request),
      ),
    };

    Object.keys(stage).forEach((key) => {
      if (stage[key] > 0) {
        departments[department][key].push(stage[key]);
        varianceBuckets[key].push(stage[key]);
      }
    });

    const day = new Date(resolveSubmitted(request)).toISOString().slice(0, 10);
    traffic[day] = (traffic[day] || 0) + 1;

    (request.auditTrail || []).forEach((event) => {
      if (
        ![
          "manager_approved",
          "manager_rejected",
          "admin_approved",
          "admin_rejected",
        ].includes(event.action)
      )
        return;
      const approver = event.actorName || "Unknown";
      if (!approvers[approver])
        approvers[approver] = {
          approver,
          approvals: 0,
          rejections: 0,
          reviewed: 0,
          totalHours: 0,
        };
      approvers[approver].reviewed += 1;
      approvers[approver].totalHours += hoursBetween(
        resolveSubmitted(request),
        event.timestamp,
      );
      if (event.action.endsWith("approved")) approvers[approver].approvals += 1;
      if (event.action.endsWith("rejected"))
        approvers[approver].rejections += 1;

      const month = new Date(event.timestamp).toISOString().slice(0, 7);
      if (!behaviorMonthly[month]) behaviorMonthly[month] = { month };
      if (!behaviorMonthly[month][`${approver}_approved`])
        behaviorMonthly[month][`${approver}_approved`] = 0;
      if (!behaviorMonthly[month][`${approver}_rejected`])
        behaviorMonthly[month][`${approver}_rejected`] = 0;
      if (event.action.endsWith("approved"))
        behaviorMonthly[month][`${approver}_approved`] += 1;
      if (event.action.endsWith("rejected"))
        behaviorMonthly[month][`${approver}_rejected`] += 1;
    });
  });

  const frictionHeatmap = Object.entries(departments).map(
    ([department, values]) => ({
      department,
      submissionToManager: Number(avg(values.submissionToManager).toFixed(2)),
      managerToAdmin: Number(avg(values.managerToAdmin).toFixed(2)),
      adminToDecision: Number(avg(values.adminToDecision).toFixed(2)),
      endToEnd: Number(avg(values.endToEnd).toFixed(2)),
    }),
  );

  const delayVariance = Object.entries(varianceBuckets).map(
    ([stage, values]) => ({
      stage,
      varianceHours: Number(stdDev(values).toFixed(2)),
      averageHours: Number(avg(values).toFixed(2)),
    }),
  );

  const workflowHealthScore = Number(
    clamp(
      100 -
        avg(delayVariance.map((item) => item.varianceHours)) * 3.2 -
        avg(delayVariance.map((item) => item.averageHours)) * 1.4,
      8,
      100,
    ).toFixed(1),
  );

  const departmentContext = collectDepartmentContext(requests);
  const requestRisk = requests.map((request) => ({
    requestId: request.id,
    title: request.title,
    department: request.department,
    amount: Number(request.amount || 0),
    status: normalizeStatus(request.status),
    ...(() => {
      const risk = deriveRisk(request, departmentContext);
      return { riskLevel: risk.level, riskScore: risk.score };
    })(),
  }));

  const riskDistribution = [
    {
      name: "Low",
      value: requestRisk.filter((item) => item.riskLevel === "Low").length,
    },
    {
      name: "Medium",
      value: requestRisk.filter((item) => item.riskLevel === "Medium").length,
    },
    {
      name: "High",
      value: requestRisk.filter((item) => item.riskLevel === "High").length,
    },
  ];

  const approverTrends = Object.values(approvers).map((item) => {
    const total = item.approvals + item.rejections;
    const rejectionRate = total ? item.rejections / total : 0;
    const overallRejectRate =
      Object.values(approvers).reduce((sum, row) => sum + row.rejections, 0) /
        Math.max(
          1,
          Object.values(approvers).reduce(
            (sum, row) => sum + row.approvals + row.rejections,
            0,
          ),
        ) || 0;
    return {
      approver: item.approver,
      approvals: item.approvals,
      rejections: item.rejections,
      rejectionRate: Number((rejectionRate * 100).toFixed(1)),
      biasIndicator: Number(
        (Math.abs(rejectionRate - overallRejectRate) * 100).toFixed(1),
      ),
      avgReviewHours: Number(
        (item.totalHours / Math.max(1, item.reviewed)).toFixed(2),
      ),
      reviewed: item.reviewed,
    };
  });

  const reviewers = getUsers().filter((item) =>
    ["manager", "admin"].includes(item.role),
  );
  const currentLoad = requests.filter((item) =>
    ["pending", "admin_review"].includes(normalizeStatus(item.status)),
  ).length;
  const capacity = Math.max(1, reviewers.length) * 6;
  const loadPercent = Number(
    clamp((currentLoad / capacity) * 100, 0, 100).toFixed(1),
  );
  const overload = loadPercent >= 78;

  const fairnessLoads = approverTrends.map((item) => ({
    manager: item.approver,
    handled: item.reviewed,
  }));
  const fairnessScore = Number(
    clamp(
      100 -
        (stdDev(fairnessLoads.map((item) => item.handled)) /
          Math.max(1, avg(fairnessLoads.map((item) => item.handled)))) *
          100,
      10,
      100,
    ).toFixed(1),
  );

  const smartEscalation = [...approverTrends]
    .sort(
      (a, b) =>
        a.avgReviewHours - b.avgReviewHours || b.approvals - a.approvals,
    )
    .slice(0, 5)
    .map((item) => ({
      approver: item.approver,
      avgReviewHours: item.avgReviewHours,
      approvalRate: Number(
        ((item.approvals / Math.max(1, item.reviewed)) * 100).toFixed(1),
      ),
      reviewed: item.reviewed,
    }));

  const processDna = Object.keys(departmentContext).map((department) => {
    const scoped = requests.filter(
      (item) => (item.department || "General") === department,
    );
    const delayFactor = Number(
      avg(
        scoped
          .map((item) =>
            hoursBetween(resolveSubmitted(item), resolveDecision(item)),
          )
          .filter(Boolean),
      ).toFixed(2),
    );
    const highRiskCount = scoped.filter(
      (item) => deriveRisk(item, departmentContext).level === "High",
    ).length;
    const riskRatio = Number(
      ((highRiskCount / Math.max(1, scoped.length)) * 100).toFixed(1),
    );
    const rejectionRate =
      scoped.filter((item) => normalizeStatus(item.status) === "rejected")
        .length / Math.max(1, scoped.length);
    const efficiencyScore = Number(
      clamp(100 - delayFactor * 1.8 - rejectionRate * 55, 6, 100).toFixed(1),
    );
    return {
      department,
      delayFactor,
      riskRatio,
      efficiencyScore,
      bottleneckSummary:
        delayFactor > 48
          ? "Critical delay observed between submission and decisioning."
          : delayFactor > 24
            ? "Moderate delay detected; manager workload rebalancing recommended."
            : "Healthy flow with low queue friction.",
      requestCount: scoped.length,
    };
  });

  const smartPulseDelay = Number(
    clamp(
      (100 - workflowHealthScore + loadPercent * 0.6) / 100,
      0.05,
      0.98,
    ).toFixed(2),
  );
  const smartPulseSuggestions = [
    ...(overload
      ? ["Enable pattern-based escalation for overloaded queues."]
      : []),
    ...(fairnessScore < 65
      ? ["Redistribute manager assignments to improve fairness."]
      : []),
    ...(workflowHealthScore < 70
      ? ["Add pre-validation checks to reduce manager rework."]
      : []),
  ];
  if (!smartPulseSuggestions.length)
    smartPulseSuggestions.push(
      "Workflow is stable. Continue monitoring SmartPulse signals.",
    );

  return {
    generatedAt: new Date().toISOString(),
    smartPulse: {
      delayProbability: smartPulseDelay,
      healthScore: workflowHealthScore,
      suggestions: smartPulseSuggestions,
    },
    friction: { frictionHeatmap, delayVariance, workflowHealthScore },
    decisionPatterns: {
      approverTrends,
      behaviorTrend: Object.values(behaviorMonthly).sort((a, b) =>
        a.month > b.month ? 1 : -1,
      ),
    },
    risk: { requestRisk, riskDistribution },
    load: {
      loadPercent,
      overload,
      currentLoad,
      capacity,
      trafficTrend: Object.entries(traffic)
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .slice(-14)
        .map(([date, volume]) => ({ date, volume })),
    },
    fairness: { fairnessScore, loads: fairnessLoads },
    smartEscalation,
    processDna,
  };
};

const unwrap = (payload) => payload?.data ?? payload;

export const getIntelligenceSnapshot = async (requests) => {
  try {
    const payload = await callApi("/intelligence/snapshot");
    return unwrap(payload);
  } catch {
    return computeSnapshotFromRequests(requests || []);
  }
};

export const simulateWorkflow = async (params, requests) => {
  try {
    const payload = await callApi("/intelligence/simulation", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return unwrap(payload);
  } catch {
    const department = params?.department || "Operations";
    const amount = Number(params?.amount || 5000);
    const priority = String(params?.priority || "medium").toLowerCase();
    const scoped = (requests || []).filter(
      (item) => (item.department || "General") === department,
    );
    const baseHours =
      avg(
        scoped
          .map((item) =>
            hoursBetween(resolveSubmitted(item), resolveDecision(item)),
          )
          .filter(Boolean),
      ) || 24;
    const estimate =
      baseHours +
      Math.min(48, amount / 1500) +
      (priority === "high" ? 18 : priority === "medium" ? 8 : 2);
    return {
      estimatedApprovalHours: Number(estimate.toFixed(1)),
      estimatedApprovalDays: Number((estimate / 24).toFixed(2)),
      predictedBottleneck:
        amount > 15000
          ? "Admin approval threshold"
          : department === "Finance"
            ? "Compliance validation"
            : "Manager review queue",
      delayProbability: Number(clamp(estimate / 72, 0.05, 0.98).toFixed(2)),
    };
  }
};

const getToken = () => {
  try {
    const raw = localStorage.getItem("smart_approval_auth");
    if (!raw) return "";
    return JSON.parse(raw)?.token || "";
  } catch {
    return "";
  }
};

const makeSimplePdfBlob = (title, lines) => {
  const safeText = [title, "", ...lines].join("\n").replace(/[()]/g, "");
  const stream = `BT /F1 10 Tf 40 780 Td (${safeText.replace(/\n/g, ") Tj T* (")}) Tj ET`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];
  let pdf = "%PDF-1.3\n";
  const xref = [0];
  objects.forEach((obj) => {
    xref.push(new TextEncoder().encode(pdf).length);
    pdf += `${obj}\n`;
  });
  const xrefStart = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${xref.length}\n0000000000 65535 f \n`;
  xref.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer << /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
};

export const exportProcessDnaPdf = async (department, report) => {
  try {
    const token = getToken();
    if (!token) throw new Error("missing token");
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    const response = await fetch(
      `${apiBase}/intelligence/process-dna/${encodeURIComponent(department)}/pdf`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) throw new Error("download failed");
    return await response.blob();
  } catch {
    return makeSimplePdfBlob(`Infosys Approval System Process DNA Report (${department})`, [
      `Department: ${department}`,
      `Delay Factor (avg hours): ${report.delayFactor}`,
      `Risk Ratio (% high risk): ${report.riskRatio}`,
      `Efficiency Score: ${report.efficiencyScore}`,
      `Bottleneck Summary: ${report.bottleneckSummary}`,
      `Generated At: ${new Date().toISOString()}`,
    ]);
  }
};

export const trackWidgetUsage = (widgetId) => {
  try {
    const raw = localStorage.getItem(LAYOUT_PREF_KEY);
    const store = raw ? JSON.parse(raw) : {};
    store[widgetId] = (store[widgetId] || 0) + 1;
    localStorage.setItem(LAYOUT_PREF_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage failures.
  }
};

export const getAdaptiveWidgetOrder = (widgetIds) => {
  try {
    const raw = localStorage.getItem(LAYOUT_PREF_KEY);
    const store = raw ? JSON.parse(raw) : {};
    return [...widgetIds].sort((a, b) => (store[b] || 0) - (store[a] || 0));
  } catch {
    return widgetIds;
  }
};

const computePredictionFallback = (payload = {}, requests = []) => {
  const amount = Number(payload.amount || 0);
  const priority = String(payload.priority || "medium").toLowerCase();
  const similar = (requests || []).filter(
    (item) =>
      String(item.department || "").toLowerCase() ===
        String(payload.department || "").toLowerCase() &&
      String(item.type || "").toLowerCase() === String(payload.type || "").toLowerCase(),
  );
  const pool = similar.length >= 3 ? similar : requests || [];
  const decided = pool.filter((item) =>
    ["approved", "rejected"].includes(String(item.status || "").toLowerCase()),
  );
  const approved = decided.filter(
    (item) => String(item.status || "").toLowerCase() === "approved",
  ).length;
  let approvalChance = decided.length ? (approved / decided.length) * 100 : 72;
  if (amount > 10000) approvalChance -= 12;
  if (amount > 20000) approvalChance -= 10;
  if (priority === "high" || priority === "critical") approvalChance -= 9;
  if (priority === "low") approvalChance += 4;

  const missingFields = [];
  if (!String(payload.title || "").trim()) missingFields.push("title");
  if (!String(payload.description || "").trim())
    missingFields.push("description");
  if (!payload.expectedDate) missingFields.push("expected_date");
  if (String(payload.description || "").trim().length > 0 &&
      String(payload.description || "").trim().length < 30) {
    missingFields.push("description_detail");
  }
  if (amount >= 12000 && !(payload.attachments || []).length) {
    missingFields.push("supporting_documents");
  }

  const cycles = pool
    .map((item) =>
      hoursBetween(resolveSubmitted(item), resolveDecision(item)),
    )
    .filter(Boolean);
  const baselineHours = avg(cycles) || 24;
  const estimatedApprovalHours = Number(
    (
      baselineHours +
      Math.min(28, amount / 1200) +
      (priority === "high" ? 10 : priority === "medium" ? 5 : 1) +
      missingFields.length * 1.5
    ).toFixed(2),
  );

  const confidenceScore = Number(
    clamp((pool.length / 20) * 70 + (100 - missingFields.length * 12) * 0.3, 20, 95).toFixed(1),
  );

  return {
    generatedAt: new Date().toISOString(),
    approvalChance: Number(clamp(approvalChance, 4, 96).toFixed(1)),
    rejectionChance: Number((100 - clamp(approvalChance, 4, 96)).toFixed(1)),
    estimatedApprovalHours,
    estimatedApprovalDays: Number((estimatedApprovalHours / 24).toFixed(2)),
    confidenceScore,
    bottleneckRisk:
      approvalChance < 45 ? "High" : approvalChance < 65 ? "Medium" : "Low",
    bottleneckSignals: [
      ...(amount > 10000
        ? ["High amount path may introduce admin queue delays."]
        : []),
      ...(missingFields.length
        ? [`${missingFields.length} quality gap(s) detected before submission.`]
        : []),
    ],
    missingFields,
    suggestedDocuments: [
      "Business justification note",
      ...(amount >= 10000 ? ["Budget owner sign-off document"] : []),
      ...(String(payload.type || "").toLowerCase().includes("travel")
        ? ["Travel itinerary", "Cost estimate sheet"]
        : []),
    ],
    recommendations: missingFields.length
      ? ["Complete missing fields/documents to improve approval confidence."]
      : ["Submission quality is strong for current workflow policies."],
  };
};

const computeBottlenecksFallback = (requests = []) => {
  const rows = (requests || []).filter((item) =>
    ["pending", "pending manager approval", "pending admin approval", "admin_review"].includes(
      String(item.status || "").toLowerCase(),
    ),
  );

  const managers = getUsers().filter((item) =>
    ["manager", "admin"].includes(String(item.role || "").toLowerCase()),
  );
  const queueByApprover = managers.map((user) => {
    const userRows = rows.filter(
      (item) =>
        item.approverId === user.id ||
        item.assignedManagerId === user.id ||
        (item.department && user.department && item.department === user.department),
    );
    const oldestPendingHours = userRows.length
      ? Math.max(
          ...userRows.map((item) =>
            hoursBetween(resolveSubmitted(item), new Date().toISOString()),
          ),
        )
      : 0;
    return {
      approverId: user.id,
      approverName: user.name || user.fullName || user.email,
      pendingCount: userRows.length,
      oldestPendingHours: Number(oldestPendingHours.toFixed(2)),
    };
  });

  const staleRequests = rows
    .map((item) => ({
      requestId: item.id,
      title: item.title,
      department: item.department || "General",
      status: String(item.status || "").toLowerCase(),
      pendingHours: Number(
        hoursBetween(resolveSubmitted(item), new Date().toISOString()).toFixed(2),
      ),
      assignedApproverName: item.approverName || "Unassigned",
    }))
    .filter((item) => item.pendingHours >= 24)
    .sort((a, b) => b.pendingHours - a.pendingHours);

  const overloadedApprovers = queueByApprover.filter((item) => item.pendingCount >= 6);
  const inactiveApprovers = queueByApprover.filter((item) => item.oldestPendingHours >= 24);
  const escalationAlerts = staleRequests
    .filter((item) => item.pendingHours >= 48)
    .map((item) => ({
      requestId: item.requestId,
      title: item.title,
      pendingHours: item.pendingHours,
      severity: item.pendingHours > 72 ? "critical" : "warning",
      message: `${item.title} pending for ${item.pendingHours.toFixed(1)}h.`,
    }));

  return {
    generatedAt: new Date().toISOString(),
    overloadedApprovers,
    inactiveApprovers,
    staleRequests,
    escalationAlerts,
    suggestedReroutes: staleRequests.slice(0, 6).map((item) => ({
      requestId: item.requestId,
      requestTitle: item.title,
      currentApprover: item.assignedApproverName,
      suggestedApprover:
        overloadedApprovers.length > 0
          ? "Alternate manager (recommended)"
          : "No reroute needed",
      suggestedApproverId: "",
      pendingHours: item.pendingHours,
      confidence: overloadedApprovers.length > 0 ? 61 : 45,
      reason:
        overloadedApprovers.length > 0
          ? "Queue balancing opportunity detected."
          : "Current queues look healthy.",
    })),
    realtimeStatus: {
      queueHealth: escalationAlerts.length
        ? "critical"
        : overloadedApprovers.length
          ? "warning"
          : "healthy",
      openQueue: rows.length,
      overloadRatio: Number(
        (overloadedApprovers.length / Math.max(1, managers.length)).toFixed(2),
      ),
      avgPendingHours: Number(
        avg(staleRequests.map((item) => item.pendingHours)).toFixed(2),
      ),
    },
  };
};

const computeFairnessFallback = (requests = []) => {
  const snapshot = computeSnapshotFromRequests(requests || []);
  const comparisons = (requests || []).map((item) => ({
    requestId: item.id,
    title: item.title,
    department: item.department || "General",
    type: item.type || "General",
    amount: Number(item.amount || 0),
    baselineOutcome: "approved",
    actualOutcome: String(item.status || "").toLowerCase(),
    approver: item.approverName || "Unknown",
    inconsistent: String(item.status || "").toLowerCase() === "rejected",
  }));

  return {
    generatedAt: new Date().toISOString(),
    fairnessScore: snapshot.fairness?.fairnessScore ?? 72,
    inconsistentDecisionRate: Number(
      (
        comparisons.filter((item) => item.inconsistent).length /
        Math.max(1, comparisons.length)
      ).toFixed(3),
    ),
    alerts:
      (snapshot.fairness?.fairnessScore || 72) < 70
        ? [
            {
              severity: "warning",
              title: "Fairness drift detected",
              message:
                "Decision consistency has dropped below target threshold.",
            },
          ]
        : [],
    approverConsistency:
      snapshot.decisionPatterns?.approverTrends?.map((item) => ({
        approverId: item.approver,
        approver: item.approver,
        reviewed: item.approvals + item.rejections,
        rejectionRate: item.rejectionRate,
        consistencyScore: Number(clamp(100 - item.biasIndicator, 20, 100).toFixed(1)),
        deviationScore: item.biasIndicator,
      })) || [],
    similarRequestComparisons: comparisons.slice(0, 120),
    auditTrail: comparisons
      .filter((item) => item.inconsistent)
      .slice(0, 120)
      .map((item) => ({
        id: `fair-${item.requestId}`,
        requestId: item.requestId,
        actor: item.approver,
        action: "decision_inconsistency_flagged",
        reason: "Outcome deviates from expected similar historical pattern.",
        timestamp: new Date().toISOString(),
      })),
  };
};

const computeDigitalTwinFallback = (params = {}) => {
  const stageMap = Array.isArray(params.stageMap) && params.stageMap.length
    ? params.stageMap
    : [
        { id: "submission_validation", label: "Submission Validation", avgHours: 3, capacityPerDay: 60, automationScore: 0.6 },
        { id: "manager_review", label: "Manager Review", avgHours: 16, capacityPerDay: 28, automationScore: 0.35 },
        { id: "admin_review", label: "Admin Review", avgHours: 14, capacityPerDay: 22, automationScore: 0.25 },
        { id: "compliance_check", label: "Compliance Check", avgHours: 8, capacityPerDay: 30, automationScore: 0.45 },
        { id: "finalization", label: "Finalization", avgHours: 4, capacityPerDay: 50, automationScore: 0.55 },
      ];

  const horizonDays = Number(clamp(Number(params.horizonDays || 14), 1, 60));
  const incomingVolumePerDay = Number(clamp(Number(params.incomingVolumePerDay || 10), 1, 500));

  let inflow = incomingVolumePerDay * horizonDays;
  const stageBreakdown = stageMap.map((stage, index) => {
    const avgHours = Number(Math.max(0.5, stage.avgHours ?? 8));
    const capacityPerDay = Number(Math.max(1, stage.capacityPerDay ?? 20));
    const automationScore = Number(clamp(stage.automationScore ?? 0.4, 0, 1));
    const serviceCapacity = capacityPerDay * horizonDays * (0.65 + automationScore * 0.7);
    const utilization = Number((inflow / Math.max(1, serviceCapacity)).toFixed(3));
    const queueDelayHours = Number((Math.max(0, utilization - 1) * avgHours * 2.2).toFixed(2));
    const stageTimeHours = Number((avgHours + queueDelayHours).toFixed(2));
    const throughput = Number(Math.min(inflow, serviceCapacity).toFixed(2));
    inflow = throughput;
    return {
      stageId: stage.id || `stage_${index + 1}`,
      stageLabel: stage.label || stage.name || `Stage ${index + 1}`,
      avgHours,
      queueDelayHours,
      stageTimeHours,
      utilization,
      serviceCapacity: Number(serviceCapacity.toFixed(2)),
      throughput,
      automationScore,
    };
  });

  const bottleneck = [...stageBreakdown].sort((a, b) => b.utilization - a.utilization)[0];
  const averageApprovalHours = Number(
    stageBreakdown.reduce((sum, stage) => sum + stage.stageTimeHours, 0).toFixed(2),
  );
  return {
    generatedAt: new Date().toISOString(),
    averageApprovalHours,
    predictedBottleneckStage: bottleneck?.stageLabel || "Unknown",
    queueLoadRisk: Number(clamp(avg(stageBreakdown.map((item) => item.utilization)) / 1.2, 0.05, 0.99).toFixed(3)),
    stageBreakdown,
    recommendations: [
      ...(bottleneck?.utilization >= 1
        ? [`Increase capacity in ${bottleneck.stageLabel} to reduce queue spillover.`]
        : []),
      ...(stageBreakdown.some((item) => item.automationScore < 0.35)
        ? ["Automate low-scoring stages to improve throughput."]
        : []),
    ],
  };
};

export const predictApprovalIntelligence = async (payload, requests) => {
  try {
    const result = await callApi("/intelligence/predict", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
    return unwrap(result);
  } catch {
    return computePredictionFallback(payload, requests || []);
  }
};

export const getWorkflowBottlenecks = async (requests) => {
  try {
    const result = await callApi("/intelligence/bottlenecks");
    return unwrap(result);
  } catch {
    return computeBottlenecksFallback(requests || []);
  }
};

export const rerouteWorkflowRequest = async (requestId, reason = "") => {
  const result = await callApi(`/intelligence/reroute/${requestId}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return unwrap(result);
};

export const runWorkflowMonitor = async (dryRun = true) => {
  const result = await callApi("/intelligence/monitor/run", {
    method: "POST",
    body: JSON.stringify({ dryRun }),
  });
  return unwrap(result);
};

export const getFairnessDiagnostics = async (requests) => {
  try {
    const result = await callApi("/intelligence/fairness");
    return unwrap(result);
  } catch {
    return computeFairnessFallback(requests || []);
  }
};

export const simulateDigitalTwin = async (params, requests) => {
  try {
    const result = await callApi("/intelligence/digital-twin/simulate", {
      method: "POST",
      body: JSON.stringify(params || {}),
    });
    return unwrap(result);
  } catch {
    return computeDigitalTwinFallback({ ...(params || {}), requests });
  }
};

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import BottleneckHeatmap from "../components/ai/BottleneckHeatmap";
import EscalationTracker from "../components/ai/EscalationTracker";
import StatCard from "../components/common/StatCard";
import { useAuth } from "../context/AuthContext";
import { useRequests } from "../context/RequestContext";
import {
  escalateAiRequest,
  getAiDashboardAnalytics,
} from "../services/aiWorkflowService";

const chartTooltipStyle = {
  background: "rgba(15, 23, 42, 0.94)",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  borderRadius: 12,
  color: "#F8FAFC",
  fontSize: 12,
};

const monthKey = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const monthLabel = (value) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
};

const pendingStatuses = new Set([
  "pending",
  "pending manager approval",
  "pending admin approval",
]);

const AIAnalyticsDashboardPage = () => {
  const { user } = useAuth();
  const { requests } = useRequests();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await getAiDashboardAnalytics(requests);
      setAnalytics(payload);
    } catch (loadError) {
      setError(loadError.message || "Failed to load AI analytics.");
    } finally {
      setLoading(false);
    }
  }, [requests]);

  useEffect(() => {
    load();
  }, [load]);

  const handleEscalate = async (requestId) => {
    setActionMessage("");
    try {
      const payload = await escalateAiRequest(
        requestId,
        "Escalated manually from AI analytics dashboard",
      );
      setActionMessage(payload.message || "Request escalated successfully.");
      await load();
    } catch (actionError) {
      setActionMessage(actionError.message || "Unable to escalate this request.");
    }
  };

  const delayChart = useMemo(
    () =>
      (analytics?.departmentWiseDelays || []).map((item) => ({
        department: item.department,
        delay: Number(item.averageDelayHours || 0),
      })),
    [analytics],
  );

  const efficiencyChart = useMemo(
    () =>
      (analytics?.departmentWiseDelays || []).map((item) => ({
        department: item.department,
        efficiency: Number(item.approvalSuccessRate || 0),
      })),
    [analytics],
  );

  const trendChart = useMemo(
    () =>
      (analytics?.requestTrends || []).map((item) => ({
        date: new Date(item.date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        count: Number(item.count || 0),
      })),
    [analytics],
  );

  const riskTrend = useMemo(() => {
    const monthlyBuckets = {};
    [...requests]
      .filter((item) => item.submittedAt)
      .forEach((item) => {
        const key = monthKey(item.submittedAt);
        if (!monthlyBuckets[key]) {
          monthlyBuckets[key] = {
            key,
            total: 0,
            highRisk: 0,
            rejected: 0,
          };
        }
        monthlyBuckets[key].total += 1;
        if (String(item.riskLevel || "").toLowerCase() === "high") {
          monthlyBuckets[key].highRisk += 1;
        }
        if (String(item.status || "").toLowerCase() === "rejected") {
          monthlyBuckets[key].rejected += 1;
        }
      });
    return Object.values(monthlyBuckets)
      .sort((a, b) => (a.key > b.key ? 1 : -1))
      .slice(-6)
      .map((item) => ({
        month: monthLabel(item.key),
        rejectionRisk: Number(((item.highRisk / Math.max(item.total, 1)) * 100).toFixed(1)),
        rejectionRate: Number(((item.rejected / Math.max(item.total, 1)) * 100).toFixed(1)),
      }));
  }, [requests]);

  const predictiveCards = useMemo(() => {
    const pending = requests.filter((item) =>
      pendingStatuses.has(String(item.status || "").toLowerCase()),
    );
    const delayedLikely = pending.filter(
      (item) =>
        Number(item.predictedDelayHours || 0) >= 24 ||
        ["critical", "overdue"].includes(
          String(item.deadlineMeta?.severity || "").toLowerCase(),
        ),
    );
    const avgDelay = pending.length
      ? pending.reduce(
          (sum, item) => sum + Number(item.predictedDelayHours || 0),
          0,
        ) / pending.length
      : 0;
    const longestQueue = pending.reduce(
      (max, item) => Math.max(max, Number(item.predictedDelayHours || 0)),
      0,
    );
    return {
      delayedLikely: delayedLikely.length,
      avgDelay: Number(avgDelay.toFixed(1)),
      longestQueue: Number(longestQueue.toFixed(1)),
    };
  }, [requests]);

  const anomalyAlerts = useMemo(() => {
    const alerts = [];
    const warningRows = analytics?.bottleneckWarnings || [];
    warningRows.forEach((warning, index) => {
      alerts.push({
        id: `warn-${index}`,
        title: "Queue anomaly detected",
        detail: warning,
        severity: "warning",
      });
    });

    const hotDepartments = (analytics?.departmentWiseDelays || []).filter(
      (item) => Number(item.averageDelayHours || 0) >= 36,
    );
    hotDepartments.forEach((item) => {
      alerts.push({
        id: `dept-${item.department}`,
        title: `${item.department} is trending slow`,
        detail: `${Number(item.averageDelayHours).toFixed(1)}h avg delay observed.`,
        severity: "danger",
      });
    });

    if (!alerts.length) {
      alerts.push({
        id: "healthy",
        title: "No critical anomalies",
        detail: "AI monitors are healthy across active queues.",
        severity: "success",
      });
    }
    return alerts.slice(0, 6);
  }, [analytics]);

  const recommendationCards = useMemo(() => {
    const slowest = [...(analytics?.departmentWiseDelays || [])]
      .sort(
        (a, b) =>
          Number(b.averageDelayHours || 0) - Number(a.averageDelayHours || 0),
      )
      .slice(0, 3);

    if (!slowest.length) {
      return [
        {
          title: "Stable Workflow",
          detail: "Current approval routes are balanced. Keep periodic monitoring enabled.",
          tone: "success",
        },
      ];
    }

    return slowest.map((item) => ({
      title: `Optimize ${item.department}`,
      detail: `Avg delay ${Number(item.averageDelayHours || 0).toFixed(1)}h. Consider auto-escalation at 18h and backup approver routing.`,
      tone: Number(item.averageDelayHours || 0) > 36 ? "danger" : "warning",
    }));
  }, [analytics]);

  if (!["manager", "admin"].includes(user?.role || "")) {
    return (
      <section className="page-stack">
        <article className="surface-card fade-in">
          <h3>Access Restricted</h3>
          <p>This AI analytics dashboard is available for manager/admin users only.</p>
        </article>
      </section>
    );
  }

  return (
    <section className="page-stack ai-analytics-page">
      <motion.article
        className="surface-card ai-analytics-hero"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <p className="prediction-eyebrow">AI Approval Intelligence Command Center</p>
          <h3>Predictive Delays, Risk Signals, and Escalation Guidance</h3>
          <p className="muted-line">
            Real-time anomaly alerts, department efficiency, rejection-risk
            trends, and smart recommendations for faster approvals.
          </p>
        </div>
        <button type="button" className="btn btn-outline" onClick={load}>
          Refresh
        </button>
      </motion.article>

      {actionMessage ? <div className="submit-success">{actionMessage}</div> : null}
      {error ? <div className="inline-error">{error}</div> : null}

      <div className="metrics-grid">
        <StatCard
          label="Avg Approval Time"
          value={`${Number(analytics?.cards?.averageApprovalTimeHours || 0).toFixed(1)}h`}
          helper="Historical average"
          icon="pending"
        />
        <StatCard
          label="Success Rate"
          value={`${Number(analytics?.cards?.approvalSuccessRate || 0).toFixed(1)}%`}
          helper="Approved vs decided"
          icon="approved"
        />
        <StatCard
          label="Delayed Requests"
          value={Number(analytics?.cards?.delayedRequests || 0)}
          helper="Predicted SLA breach"
          icon="rejected"
        />
        <StatCard
          label="Active Escalations"
          value={Number(analytics?.cards?.activeEscalations || 0)}
          helper="Open escalation threads"
          icon="total"
        />
      </div>

      {loading ? (
        <div className="skeleton-grid">
          <div className="skeleton-item" />
          <div className="skeleton-item" />
        </div>
      ) : (
        <>
          <section className="analytics-grid ai-analytics-grid">
            <article className="surface-card ai-chart-card">
              <div className="card-head">
                <h3>Predictive Delay Insights</h3>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={delayChart}>
                  <CartesianGrid stroke="#CBD5E1" strokeDasharray="3 8" vertical={false} />
                  <XAxis dataKey="department" tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="delay" fill="#0EA5E9" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </article>

            <article className="surface-card ai-chart-card">
              <div className="card-head">
                <h3>Department Approval Efficiency</h3>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={efficiencyChart}>
                  <CartesianGrid stroke="#CBD5E1" strokeDasharray="3 8" vertical={false} />
                  <XAxis dataKey="department" tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="efficiency" fill="#22C55E" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </article>

            <article className="surface-card ai-chart-card">
              <div className="card-head">
                <h3>Historical Trends Visualization</h3>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trendChart}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#CBD5E1" strokeDasharray="3 8" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Area type="monotone" dataKey="count" stroke="#0284C7" strokeWidth={2.5} fill="url(#trendFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </article>

            <article className="surface-card ai-chart-card">
              <div className="card-head">
                <h3>Rejection Risk Trends</h3>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={riskTrend}>
                  <CartesianGrid stroke="#CBD5E1" strokeDasharray="3 8" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Line type="monotone" dataKey="rejectionRisk" stroke="#F97316" strokeWidth={2.6} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="rejectionRate" stroke="#EF4444" strokeWidth={2.6} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </article>
          </section>

          <section className="ai-predictive-grid">
            <article className="surface-card ai-predictive-card">
              <span>Likely Delays (next cycle)</span>
              <strong>{predictiveCards.delayedLikely}</strong>
            </article>
            <article className="surface-card ai-predictive-card">
              <span>Average Predicted Delay</span>
              <strong>{predictiveCards.avgDelay}h</strong>
            </article>
            <article className="surface-card ai-predictive-card">
              <span>Longest Predicted Queue</span>
              <strong>{predictiveCards.longestQueue}h</strong>
            </article>
          </section>

          <section className="ai-recommendation-grid">
            {recommendationCards.map((item) => (
              <article
                key={item.title}
                className={`surface-card ai-recommendation-card tone-${item.tone}`}
              >
                <h4>{item.title}</h4>
                <p>{item.detail}</p>
              </article>
            ))}
          </section>

          <article className="surface-card ai-alerts-card">
            <div className="card-head">
              <h3>Real-Time Anomaly Alerts</h3>
            </div>
            <div className="ai-alert-list">
              {anomalyAlerts.map((alert) => (
                <article
                  key={alert.id}
                  className={`ai-alert-item severity-${alert.severity}`}
                >
                  <strong>{alert.title}</strong>
                  <p>{alert.detail}</p>
                </article>
              ))}
            </div>
          </article>

          <BottleneckHeatmap rows={analytics?.bottleneckHeatmap || []} />
          <EscalationTracker escalations={analytics?.escalations?.recent || []} />

          <article className="surface-card">
            <div className="card-head">
              <h3>Stuck Requests</h3>
            </div>
            {(analytics?.stuckRequests || []).length ? (
              <div className="workflow-ops-list">
                {analytics.stuckRequests.map((item) => (
                  <div key={item.requestId} className="workflow-ops-item warning">
                    <div>
                      <strong>{item.title}</strong>
                      <p>
                        {item.department} | {item.approverName}
                      </p>
                      <small>{item.pendingHours.toFixed(1)}h pending</small>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleEscalate(item.requestId)}
                    >
                      Escalate
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-line">No stuck requests at the moment.</p>
            )}
          </article>
        </>
      )}
    </section>
  );
};

export default AIAnalyticsDashboardPage;

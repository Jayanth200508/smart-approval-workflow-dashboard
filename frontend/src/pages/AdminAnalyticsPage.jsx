import { useEffect, useState } from "react";
import AnalyticsCharts from "../components/charts/AnalyticsCharts";
import ExportActions from "../components/common/ExportActions";
import StatCard from "../components/common/StatCard";
import { useAuth } from "../context/AuthContext";
import { useRequests } from "../context/RequestContext";
import { getFairnessDiagnostics } from "../services/intelligenceService";

const AdminAnalyticsPage = () => {
  const { user } = useAuth();
  const { requests, stats, loading } = useRequests();
  const [fairness, setFairness] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadFairness = async () => {
      const payload = await getFairnessDiagnostics(requests);
      if (!cancelled) setFairness(payload);
    };
    loadFairness();
    return () => {
      cancelled = true;
    };
  }, [requests]);

  if (user.role !== "admin") {
    return (
      <section className="page-stack">
        <article className="surface-card fade-in">
          <h3>Admin Access Required</h3>
          <p>
            This page is limited to admin accounts for governance and
            organization-wide analytics.
          </p>
        </article>
      </section>
    );
  }

  const approvalRate = stats.total
    ? `${Math.round((stats.approved / stats.total) * 100)}%`
    : "0%";
  const rejectionRate = stats.total
    ? `${Math.round((stats.rejected / stats.total) * 100)}%`
    : "0%";
  const avgTicket = stats.total
    ? `$${Math.round(requests.reduce((sum, item) => sum + Number(item.amount || 0), 0) / stats.total).toLocaleString()}`
    : "$0";

  return (
    <section className="page-stack">
      <div className="metrics-grid">
        <StatCard
          label="Approval Rate"
          value={approvalRate}
          helper="Accepted decisions"
          trend="+3.1%"
          icon="approved"
        />
        <StatCard
          label="Rejection Rate"
          value={rejectionRate}
          helper="Needs process tuning"
          trend="-0.8%"
          icon="rejected"
        />
        <StatCard
          label="Average Ticket"
          value={avgTicket}
          helper="Value per request"
          trend="+6.2%"
          icon="total"
        />
        <StatCard
          label="Total Volume"
          value={stats.total}
          helper="Current dataset size"
          trend="+4.7%"
          icon="pending"
        />
      </div>

      {loading ? (
        <div className="skeleton-grid">
          <div className="skeleton-item" />
          <div className="skeleton-item" />
        </div>
      ) : (
        <>
          <ExportActions rows={requests} fileName="admin-analytics-report" />
          <AnalyticsCharts requests={requests} stats={stats} />
          <article className="surface-card fade-in subtle-highlight">
            <h3>Executive Insight</h3>
            <p>
              Approval throughput is stable. Engineering and Procurement show
              the highest variance in decision time, suggesting queue balancing
              opportunities.
            </p>
          </article>
          {fairness ? (
            <article className="surface-card fade-in subtle-highlight">
              <h3>Approval Fairness / Bias Detection</h3>
              <p>
                Fairness Score: <strong>{Number(fairness.fairnessScore || 0).toFixed(1)}</strong> |
                Inconsistent Decisions:{" "}
                <strong>
                  {(Number(fairness.inconsistentDecisionRate || 0) * 100).toFixed(1)}%
                </strong>
              </p>
              {(fairness.alerts || []).length ? (
                <ul className="executive-alert-list">
                  {fairness.alerts.map((item) => (
                    <li key={`${item.title}-${item.message}`}>
                      <strong>{item.title}:</strong> {item.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted-line">
                  No major fairness anomalies detected in current historical patterns.
                </p>
              )}
            </article>
          ) : null}
        </>
      )}
    </section>
  );
};

export default AdminAnalyticsPage;

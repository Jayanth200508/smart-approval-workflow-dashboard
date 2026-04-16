import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import StatCard from "../components/common/StatCard";
import RequestTable from "../components/requests/RequestTable";
import { useRequests } from "../context/RequestContext";

const chartTooltipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: 10,
  color: "#0F172A",
  fontSize: 12,
};

const DashboardPage = () => {
  const PAGE_SIZE = 6;
  const { requests, stats, loading, error, lastSyncedAt } = useRequests();
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));
  const visibleRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return requests.slice(start, start + PAGE_SIZE);
  }, [requests, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pendingCount = useMemo(
    () =>
      requests.filter((item) =>
        ["Pending", "Pending Manager Approval", "Pending Admin Approval"].includes(
          item.status,
        ),
      ).length,
    [requests],
  );

  const statusData = useMemo(
    () => [
      { name: "Approved", value: stats.approved || 0, fill: "#16A34A" },
      { name: "Pending", value: pendingCount || 0, fill: "#F59E0B" },
      { name: "Rejected", value: stats.rejected || 0, fill: "#DC2626" },
    ],
    [pendingCount, stats.approved, stats.rejected],
  );

  const timelineItems = useMemo(
    () =>
      [...requests]
        .sort(
          (a, b) =>
            new Date(b.lastUpdated || b.submittedAt).getTime() -
            new Date(a.lastUpdated || a.submittedAt).getTime(),
        )
        .slice(0, 6)
        .map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          timestamp: item.lastUpdated || item.submittedAt,
          note:
            item.decisionComment ||
            (item.status === "Approved"
              ? "Request completed successfully."
              : item.status === "Rejected"
                ? "Request was rejected. Review comments and resubmit if needed."
                : "Request is progressing through approver queues."),
        })),
    [requests],
  );

  return (
    <section className="page-stack">
      <div className="card-head">
        <h3>Employee Dashboard</h3>
      </div>

      <div className="metrics-grid">
        <StatCard
          label="Total Requests"
          value={stats.total}
          helper="Submitted by you"
          icon="total"
        />
        <StatCard
          label="Pending"
          value={pendingCount}
          helper="In progress"
          icon="pending"
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          helper="Completed"
          icon="approved"
        />
        <StatCard
          label="Rejected"
          value={stats.rejected}
          helper="Needs update"
          icon="rejected"
        />
      </div>

      {error ? <div className="inline-error">{error}</div> : null}

      <section className="analytics-grid">
        <article className="surface-card">
          <div className="card-head">
            <h3>My Requests Status</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                outerRadius={98}
                innerRadius={54}
                cornerRadius={5}
              >
                {statusData.map((item) => (
                  <Cell key={item.name} fill={item.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </article>

        <article className="surface-card">
          <div className="card-head">
            <h3>Request Timeline</h3>
            <small className="muted-line">
              Last synced:{" "}
              {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : "-"}
            </small>
          </div>
          {timelineItems.length ? (
            <div className="activity-timeline-rail">
              {timelineItems.map((item) => (
                <article key={item.id} className="timeline-rail-item">
                  <span className="timeline-rail-dot" />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.note}</p>
                    <small>
                      {item.status} | {new Date(item.timestamp).toLocaleString()}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted-line">
              No request activity yet. Submit your first request to start
              tracking.
            </p>
          )}
        </article>
      </section>

      <article className="surface-card">
        <div className="card-head">
          <h3>Status Tracking</h3>
        </div>
        {loading ? (
          <div className="skeleton-grid">
            <div className="skeleton-item short" />
            <div className="skeleton-item short" />
          </div>
        ) : (
          <RequestTable
            rows={visibleRows}
            canTakeAction={false}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            showPriority
          />
        )}
      </article>
    </section>
  );
};

export default DashboardPage;

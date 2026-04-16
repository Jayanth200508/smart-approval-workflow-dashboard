import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PaginationControls from "../components/common/PaginationControls";
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

const monthKey = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (key) => {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
};

const AdminDashboardPage = () => {
  const PAGE_SIZE = 8;
  const { requests, stats, loading } = useRequests();
  const [page, setPage] = useState(1);
  const pendingStatuses = useMemo(
    () =>
      new Set(["Pending", "Pending Manager Approval", "Pending Admin Approval"]),
    [],
  );

  const pendingRequests = useMemo(
    () =>
      requests.filter((item) =>
        pendingStatuses.has(String(item.status || "").trim()),
      ),
    [requests, pendingStatuses],
  );

  const totalPages = Math.max(1, Math.ceil(pendingRequests.length / PAGE_SIZE));
  const reviewQueue = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return pendingRequests.slice(start, start + PAGE_SIZE);
  }, [pendingRequests, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const delayedRequests = useMemo(
    () =>
      pendingRequests.filter(
        (item) =>
          item.isOverdue ||
          ["critical", "overdue"].includes(
            String(item?.deadlineMeta?.severity || "").toLowerCase(),
          ),
      ).length,
    [pendingRequests],
  );

  const aiRiskAlerts = useMemo(
    () =>
      pendingRequests.filter((item) => {
        const riskLevel = String(item.riskLevel || "").toLowerCase();
        const probability = Number(item.approvalProbability ?? 1);
        return riskLevel === "high" || probability < 0.45;
      }).length,
    [pendingRequests],
  );

  const approvalVsRejection = useMemo(
    () => [
      { name: "Approved", count: stats.approved || 0, fill: "#16A34A" },
      { name: "Rejected", count: stats.rejected || 0, fill: "#DC2626" },
    ],
    [stats.approved, stats.rejected],
  );

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const recentMonths = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      recentMonths.push(monthKey(date));
    }
    const grouped = requests.reduce((acc, item) => {
      const key = monthKey(item.submittedAt || item.lastUpdated || new Date());
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return recentMonths.map((key) => ({
      month: monthLabel(key),
      count: grouped[key] || 0,
    }));
  }, [requests]);

  return (
    <section className="page-stack">
      <div className="card-head">
        <h3>Admin Dashboard</h3>
      </div>

      <div className="metrics-grid">
        <StatCard
          label="Total Requests"
          value={stats.total}
          helper="All requests"
          icon="total"
        />
        <StatCard
          label="Pending Approvals"
          value={pendingRequests.length}
          helper="Waiting review"
          icon="pending"
        />
        <StatCard
          label="Delayed Requests"
          value={delayedRequests}
          helper="Near or beyond SLA"
          icon="rejected"
        />
        <StatCard
          label="AI Risk Alerts"
          value={aiRiskAlerts}
          helper="High rejection risk"
          icon="approved"
        />
      </div>

      <section className="analytics-grid">
        <article className="surface-card">
          <div className="card-head">
            <h3>Approval vs Rejection</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={approvalVsRejection} barSize={46}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 8" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {approvalVsRejection.map((item) => (
                  <Cell key={item.name} fill={item.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="surface-card">
          <div className="card-head">
            <h3>Monthly Requests</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 8" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#2563EB"
                strokeWidth={2.5}
                dot={{ r: 2, fill: "#2563EB" }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </article>
      </section>

      <article className="surface-card">
        <div className="card-head">
          <h3>Pending Review Snapshot</h3>
          <Link to="/admin/approvals" className="btn btn-primary btn-sm">
            Open Approvals
          </Link>
        </div>
        <p className="muted-line">
          Decision actions were moved to the Approvals page to keep dashboard
          navigation focused on KPI and analytics.
        </p>
        {loading ? (
          <div className="skeleton-grid">
            <div className="skeleton-item short" />
            <div className="skeleton-item short" />
          </div>
        ) : (
          <>
            <RequestTable
              rows={reviewQueue}
              canTakeAction={false}
              hideActions
              showPriority
              mode="admin"
            />
            <PaginationControls
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </article>
    </section>
  );
};

export default AdminDashboardPage;

import { useMemo } from "react";
import StatCard from "../components/common/StatCard";
import RequestTable from "../components/requests/RequestTable";
import { useAuth } from "../context/AuthContext";
import { useRequests } from "../context/RequestContext";

const ManagerDashboardPage = () => {
  const { user } = useAuth();
  const { requests } = useRequests();

  const departmentRequests = useMemo(
    () => requests.filter((item) => item.department === user?.department),
    [requests, user?.department],
  );

  const pending = departmentRequests.filter(
    (item) => item.status === "Pending Manager Approval",
  ).length;
  const approved = departmentRequests.filter(
    (item) => item.status === "Approved",
  ).length;
  const rejected = departmentRequests.filter(
    (item) => item.status === "Rejected",
  ).length;

  const recentPending = departmentRequests
    .filter((item) => item.status === "Pending Manager Approval")
    .slice(0, 8);

  return (
    <section className="page-stack">
      <div className="metrics-grid">
        <StatCard
          label="Department Requests"
          value={departmentRequests.length}
          helper={`${user?.department || "Department"} requests`}
          icon="total"
        />
        <StatCard
          label="Pending Approvals"
          value={pending}
          helper="Awaiting your review"
          icon="pending"
        />
        <StatCard
          label="Approved Requests"
          value={approved}
          helper="Resolved by manager/admin"
          icon="approved"
        />
        <StatCard
          label="Rejected Requests"
          value={rejected}
          helper="Rejected with reason"
          icon="rejected"
        />
      </div>

      <article className="surface-card fade-in">
        <div className="card-head">
          <h3>Pending Department Requests</h3>
        </div>
        <RequestTable rows={recentPending} mode="manager" />
      </article>
    </section>
  );
};

export default ManagerDashboardPage;


import { useEffect, useMemo, useState } from "react";
import RequestFilters from "../components/requests/RequestFilters";
import RequestTable from "../components/requests/RequestTable";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { useRequests } from "../context/RequestContext";
import { listUsers } from "../services/workflowService";

const pendingStatuses = new Set([
  "Pending",
  "Pending Manager Approval",
  "Pending Admin Approval",
]);

const priorityWeight = {
  critical: 5,
  urgent: 5,
  high: 4,
  medium: 3,
  low: 2,
};

const severityWeight = {
  overdue: 5,
  critical: 4,
  warning: 3,
  normal: 2,
  none: 1,
};

const riskWeight = (item) => {
  const level = String(item.riskLevel || "").toLowerCase();
  if (level === "high") return 5;
  if (level === "medium") return 3;
  if (level === "low") return 1;
  const chance = Number(item.approvalProbability ?? 1);
  if (Number.isNaN(chance)) return 1;
  return chance < 0.45 ? 4 : chance < 0.7 ? 2 : 1;
};

const ApprovalsPage = () => {
  const PAGE_SIZE = 10;
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { requests, takeDecision, loading } = useRequests();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [selectedUser, setSelectedUser] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [sortBy, setSortBy] = useState("SLAUrgency");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);

  const isAdmin = user.role === "admin";
  const isManager = user.role === "manager";
  const canApprove = isAdmin || isManager;
  const employeeUsers = listUsers().filter((item) => item.role === "employee");

  const scopedList = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests
      .filter((item) =>
        isManager ? item.department === user.department : true,
      )
      .filter((item) =>
        departmentFilter === "All"
          ? true
          : item.department === departmentFilter,
      )
      .filter((item) =>
        selectedUser === "All" ? true : item.requesterId === selectedUser,
      )
      .filter((item) =>
        priorityFilter === "All"
          ? true
          : String(item.priority || "").toLowerCase() ===
            priorityFilter.toLowerCase(),
      )
      .filter((item) => {
        if (!dateFilter) return true;
        return (
          new Date(item.submittedAt).toISOString().slice(0, 10) === dateFilter
        );
      })
      .filter((item) =>
        [item.id, item.title, item.department, item.type, item.requesterName]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
  }, [
    requests,
    search,
    departmentFilter,
    selectedUser,
    dateFilter,
    priorityFilter,
    isManager,
    user.department,
  ]);

  const filtered = useMemo(
    () =>
      scopedList
        .filter((item) =>
          statusFilter === "All" ? true : item.status === statusFilter,
        )
      .sort((a, b) => {
        if (sortBy === "Oldest") {
          return new Date(a.submittedAt) - new Date(b.submittedAt);
        }
        if (sortBy === "Priority") {
          return (
            (priorityWeight[String(b.priority || "medium").toLowerCase()] || 1) -
            (priorityWeight[String(a.priority || "medium").toLowerCase()] || 1)
          );
        }
        if (sortBy === "AIRisk") {
          return riskWeight(b) - riskWeight(a);
        }
        if (sortBy === "Newest") {
          return new Date(b.submittedAt) - new Date(a.submittedAt);
        }
        return (
          (severityWeight[String(b.deadlineMeta?.severity || "none").toLowerCase()] || 1) -
            (severityWeight[String(a.deadlineMeta?.severity || "none").toLowerCase()] || 1) ||
          new Date(b.submittedAt) - new Date(a.submittedAt)
        );
      }),
    [scopedList, statusFilter, sortBy],
  );

  const pendingCount = useMemo(
    () => scopedList.filter((item) => pendingStatuses.has(item.status)).length,
    [scopedList],
  );
  const delayedCount = useMemo(
    () =>
      scopedList.filter(
        (item) =>
          item.isOverdue ||
          ["critical", "overdue"].includes(
            String(item.deadlineMeta?.severity || "").toLowerCase(),
          ),
      ).length,
    [scopedList],
  );
  const highRiskCount = useMemo(
    () =>
      scopedList.filter((item) => {
        const risk = String(item.riskLevel || "").toLowerCase();
        const chance = Number(item.approvalProbability ?? 1);
        return risk === "high" || chance < 0.45;
      }).length,
    [scopedList],
  );
  const statusCounts = useMemo(
    () => ({
      All: scopedList.length,
      "Pending Manager Approval": scopedList.filter(
        (item) => item.status === "Pending Manager Approval",
      ).length,
      "Pending Admin Approval": scopedList.filter(
        (item) => item.status === "Pending Admin Approval",
      ).length,
      Approved: scopedList.filter((item) => item.status === "Approved").length,
      Rejected: scopedList.filter((item) => item.status === "Rejected").length,
    }),
    [scopedList],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage, PAGE_SIZE]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [
    search,
    statusFilter,
    departmentFilter,
    selectedUser,
    dateFilter,
    priorityFilter,
    sortBy,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleDecision = async (id, status) => {
    const note = window.prompt(`${status} reason (required):`, "");
    if (!note?.trim()) {
      window.alert("Reason is required.");
      return;
    }
    const current = requests.find((item) => item.id === id);
    await takeDecision(id, {
      status,
      comment: note.trim(),
      approverName: user.fullName,
    });
    addNotification({
      title: `Request ${status.toLowerCase()}`,
      message: `${current?.title || "Request"} was ${status.toLowerCase()} by ${user.fullName}.`,
      tone: status === "Approved" ? "success" : "error",
    });
  };

  const handleToggleSelect = (id, checked) => {
    setSelectedIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((item) => item !== id),
    );
  };

  const handleSelectAll = (visibleRows, checked) => {
    if (!checked) {
      setSelectedIds((prev) => prev.filter((id) => !visibleRows.some((row) => row.id === id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...visibleRows.map((row) => row.id)])]);
  };

  const runBulkAction = async (status) => {
    if (!selectedIds.length) return;
    const reason = window.prompt(`${status} reason (required):`, "");
    if (!reason?.trim()) {
      window.alert("Reason is required.");
      return;
    }
    for (const id of selectedIds) {
      // sequential on purpose to preserve ordering and avoid conflicting mock writes
      // eslint-disable-next-line no-await-in-loop
      await takeDecision(id, {
        status,
        comment: reason.trim(),
        approverName: user.fullName,
      });
    }
    setSelectedIds([]);
    addNotification({
      title: `Bulk ${status.toLowerCase()} complete`,
      message: `${selectedIds.length} request(s) were ${status.toLowerCase()}.`,
      tone: status === "Approved" ? "success" : "error",
    });
  };

  const handleEscalate = async (id) => {
    const reason = window.prompt("Escalation reason (required):", "");
    if (!reason?.trim()) {
      window.alert("Escalation reason is required.");
      return;
    }
    await takeDecision(id, {
      status: "Pending Admin Approval",
      comment: reason.trim(),
      approverName: user.fullName,
    });
  };

  return (
    <section className="page-stack approvals-page">
      <article className="surface-card fade-in">
        <h3>{isManager ? "Department Requests" : "All Requests Management"}</h3>
        <RequestFilters
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          departmentFilter={departmentFilter}
          setDepartmentFilter={setDepartmentFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOptions={[
            { value: "SLAUrgency", label: "SLA Urgency" },
            { value: "AIRisk", label: "AI Risk Score" },
            { value: "Priority", label: "Priority Level" },
            { value: "Newest", label: "Newest" },
            { value: "Oldest", label: "Oldest" },
          ]}
        />
        <div className="filters-grid extra-filters">
          <label>
            <span>Priority</span>
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
            >
              <option value="All">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </label>
          <label>
            <span>User</span>
            <select
              value={selectedUser}
              onChange={(event) => setSelectedUser(event.target.value)}
            >
              <option value="All">All Users</option>
              {employeeUsers
                .filter((item) =>
                  isManager ? item.department === user.department : true,
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fullName}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>Date</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
            />
          </label>
          <div />
          <div />
        </div>
        <div className="status-chip-row" role="tablist" aria-label="Quick status filter">
          {[
            "All",
            "Pending Manager Approval",
            "Pending Admin Approval",
            "Approved",
            "Rejected",
          ].map((status) => (
            <button
              key={status}
              type="button"
              className={`status-chip ${statusFilter === status ? "active" : ""}`}
              onClick={() => setStatusFilter(status)}
            >
              {status} ({statusCounts[status] || 0})
            </button>
          ))}
        </div>
        <div className="mini-metrics">
          <div>
            <span>Pending Approval</span>
            <strong>{pendingCount}</strong>
          </div>
          <div>
            <span>Delayed / SLA Risk</span>
            <strong>{delayedCount}</strong>
          </div>
          <div>
            <span>AI Risk Alerts</span>
            <strong>{highRiskCount}</strong>
          </div>
        </div>
        <p className="muted-line">
          Filter by status, department, date, and user. Approver decisions
          update the employee notification stream.
        </p>

        {canApprove ? (
          <div className="bulk-action-bar">
            <span>{selectedIds.length} selected</span>
            <button
              type="button"
              className="btn btn-success btn-sm"
              disabled={!selectedIds.length}
              onClick={() => runBulkAction("Approved")}
            >
              Bulk Approve
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={!selectedIds.length}
              onClick={() => runBulkAction("Rejected")}
            >
              Bulk Reject
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={!selectedIds.length}
              onClick={() => setSelectedIds([])}
            >
              Clear Selection
            </button>
          </div>
        ) : null}

        {!canApprove ? (
          <div className="inline-error">Access denied.</div>
        ) : null}

        {loading ? (
          <div className="skeleton-grid">
            <div className="skeleton-item short" />
            <div className="skeleton-item short" />
          </div>
        ) : (
          <RequestTable
            rows={pagedRows}
            canTakeAction={canApprove}
            onDecision={handleDecision}
            onEscalate={isManager ? handleEscalate : undefined}
            mode={isManager ? "manager" : "admin"}
            page={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            selectable={canApprove}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            showPriority
            tableVariant="approvals"
            stickyActions
          />
        )}
      </article>
    </section>
  );
};

export default ApprovalsPage;

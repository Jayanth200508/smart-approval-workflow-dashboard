import { useEffect, useMemo, useState } from "react";
import RequestFilters from "../components/requests/RequestFilters";
import RequestTable from "../components/requests/RequestTable";
import { useAuth } from "../context/AuthContext";
import { useRequests } from "../context/RequestContext";

const PAGE_SIZE = 10;

const DepartmentRequestsPage = ({ onlyApproved = false }) => {
  const { user } = useAuth();
  const { requests, takeDecision, loading } = useRequests();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [page, setPage] = useState(1);

  const scopedRequests = useMemo(
    () => requests.filter((item) => item.department === user?.department),
    [requests, user?.department],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return scopedRequests
      .filter((item) =>
        onlyApproved
          ? item.status === "Approved" || item.status === "Rejected"
          : true,
      )
      .filter((item) =>
        statusFilter === "All" ? true : item.status === statusFilter,
      )
      .filter((item) =>
        departmentFilter === "All"
          ? true
          : item.department === departmentFilter,
      )
      .filter((item) =>
        [item.id, item.title, item.department, item.type, item.requesterName]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
  }, [scopedRequests, search, statusFilter, departmentFilter, onlyApproved]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pagedRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const onDecision = async (id, actionType) => {
    const isEscalation = actionType === "Pending Admin Approval";
    const promptLabel = isEscalation
      ? "Escalation reason"
      : `${actionType} reason`;
    const comment = window.prompt(`${promptLabel} (required):`, "");
    if (!comment?.trim()) {
      window.alert("Reason is required.");
      return;
    }
    await takeDecision(id, {
      status: actionType,
      comment: comment.trim(),
      approverName: user?.fullName || "Manager",
    });
  };

  return (
    <section className="page-stack">
      <article className="surface-card fade-in">
        <h3>{onlyApproved ? "Approved / Rejected Requests" : "Department Requests"}</h3>
        <RequestFilters
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          departmentFilter={departmentFilter}
          setDepartmentFilter={setDepartmentFilter}
        />

        {loading ? (
          <div className="skeleton-grid">
            <div className="skeleton-item short" />
            <div className="skeleton-item short" />
          </div>
        ) : (
          <RequestTable
            rows={pagedRows}
            canTakeAction={!onlyApproved}
            onDecision={onDecision}
            onEscalate={(id) => onDecision(id, "Pending Admin Approval")}
            mode="manager"
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </article>
    </section>
  );
};

export default DepartmentRequestsPage;


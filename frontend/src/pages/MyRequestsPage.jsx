import { useEffect, useMemo, useState } from "react";
import ExportActions from "../components/common/ExportActions";
import EmptyState from "../components/requests/EmptyState";
import RequestFilters from "../components/requests/RequestFilters";
import RequestTable from "../components/requests/RequestTable";
import { useAuth } from "../context/AuthContext";
import { useRequests } from "../context/RequestContext";

const PAGE_SIZE = 6;

const MyRequestsPage = () => {
  const { user } = useAuth();
  const { requests, loading, cancelRequest, editRequest } = useRequests();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [sortBy, setSortBy] = useState("Newest");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let list = requests
      .filter(
        (item) =>
          item.requesterId === user.id || item.requesterName === user.fullName,
      )
      .filter((item) =>
        statusFilter === "All" ? true : item.status === statusFilter,
      )
      .filter((item) =>
        departmentFilter === "All"
          ? true
          : item.department === departmentFilter,
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

    list.sort((a, b) => {
      if (sortBy === "Oldest")
        return new Date(a.submittedAt) - new Date(b.submittedAt);
      if (sortBy === "AmountHigh")
        return Number(b.amount || 0) - Number(a.amount || 0);
      if (sortBy === "AmountLow")
        return Number(a.amount || 0) - Number(b.amount || 0);
      return new Date(b.submittedAt) - new Date(a.submittedAt);
    });

    return list;
  }, [
    requests,
    user,
    debouncedSearch,
    statusFilter,
    departmentFilter,
    dateFilter,
    sortBy,
  ]);

  const totalOwnedRequests = useMemo(
    () =>
      requests.filter(
        (item) =>
          item.requesterId === user.id || item.requesterName === user.fullName,
      ).length,
    [requests, user.id, user.fullName],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, departmentFilter, dateFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleWithdraw = async (requestId) => {
    const target = requests.find((item) => item.id === requestId);
    if (!target || target.status !== "Pending") {
      window.alert("Only pending requests can be cancelled.");
      return;
    }
    const confirmed = window.confirm("Cancel this pending request?");
    if (!confirmed) return;
    const comment = window.prompt("Optional cancellation reason:", "") || "";
    await cancelRequest(requestId, { comment });
  };

  const handleEdit = async (request) => {
    if (request.status !== "Pending") {
      window.alert("Only pending requests can be edited.");
      return;
    }
    const nextTitle = window.prompt("Edit request title:", request.title);
    if (nextTitle === null) return;
    const nextDescription = window.prompt(
      "Edit request description:",
      request.description || "",
    );
    if (nextDescription === null) return;
    const nextPriority = window.prompt(
      "Priority (Low, Medium, High):",
      request.priority || "Medium",
    );
    if (nextPriority === null) return;
    await editRequest(request.id, {
      title: nextTitle.trim() || request.title,
      description: nextDescription.trim() || request.description,
      department: request.department,
      priority: nextPriority.trim() || request.priority,
      comment: "Request edited by requester",
    });
  };

  const handleDownload = (request) => {
    const blob = new Blob(
      [
        `Infosys Approval System Request Export\n\n` +
          `Infosys Approval System\n\n` +
          `Request ID: ${request.id}\n` +
          `Title: ${request.title}\n` +
          `Department: ${request.department}\n` +
          `Status: ${request.status}\n` +
          `Submitted: ${new Date(request.submittedAt).toLocaleString()}\n` +
          `Description: ${request.description || "-"}\n`,
      ],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${request.id}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="page-stack">
      <article className="surface-card fade-in">
        <div className="card-head">
          <h3>My Submitted Requests</h3>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              window.dispatchEvent(new Event("flowpilot:new-request"))
            }
          >
            New Request
          </button>
        </div>

        <RequestFilters
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          departmentFilter={departmentFilter}
          setDepartmentFilter={setDepartmentFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />
        <div className="filters-grid extra-filters">
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
          <div />
        </div>
        <ExportActions rows={filtered} fileName="my-requests-report" />

        {loading ? (
          <div className="skeleton-grid">
            <div className="skeleton-item short" />
            <div className="skeleton-item short" />
          </div>
        ) : filtered.length ? (
          <RequestTable
            rows={paginated}
            canTakeAction={false}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onWithdraw={handleWithdraw}
            onDownload={handleDownload}
            onEdit={handleEdit}
            showPriority
          />
        ) : totalOwnedRequests ? (
          <div className="table-empty">No matching records found.</div>
        ) : (
          <EmptyState
            onCreate={() =>
              window.dispatchEvent(new Event("flowpilot:new-request"))
            }
          />
        )}
      </article>
    </section>
  );
};

export default MyRequestsPage;

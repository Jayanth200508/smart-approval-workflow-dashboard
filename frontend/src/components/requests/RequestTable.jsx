import { memo, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../common/StatusBadge";
import {
  getDeadlineMeta,
  getSmartApprovalSuggestion,
  isOverdue,
} from "../../utils/requestInsights";

const detailPathFor = (itemId, mode) =>
  mode === "admin"
    ? `/admin/requests/${itemId}`
    : `/employee/requests/${itemId}`;

const ActionMenu = memo(({ item, mode, onWithdraw, onDownload, onEdit }) => {
  const [open, setOpen] = useState(false);
  const isPending = item.status === "Pending";

  return (
    <div className="row-action-menu">
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => setOpen((prev) => !prev)}
      >
        Actions
      </button>
      {open ? (
        <div className="menu-popover">
          <Link to={detailPathFor(item.id, mode)}>View</Link>
          {mode !== "admin" && isPending && onEdit ? (
            <button type="button" onClick={() => onEdit(item)}>
              Edit
            </button>
          ) : null}
          {mode !== "admin" && isPending && onWithdraw ? (
            <button type="button" onClick={() => onWithdraw(item.id)}>
              Cancel
            </button>
          ) : null}
          {mode !== "admin" && onDownload ? (
            <button type="button" onClick={() => onDownload(item)}>
              Download
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

const RequestRowActions = memo(({
  item,
  canTakeAction,
  onDecision,
  onEscalate,
  mode,
  onWithdraw,
  onDownload,
  onEdit,
  compactActions = false,
}) => {
  const [pendingAction, setPendingAction] = useState("");
  const managerCanAct = mode === "manager" && item.status === "Pending Manager Approval";
  const adminCanAct =
    mode === "admin" &&
    ["Pending Admin Approval", "Pending Manager Approval", "Pending"].includes(
      item.status,
    );
  const busy = Boolean(pendingAction);

  const runAction = async (actionKey, callback) => {
    if (busy) return;
    setPendingAction(actionKey);
    try {
      await callback();
    } finally {
      setPendingAction("");
    }
  };

  if (canTakeAction && (managerCanAct || adminCanAct)) {
    return (
      <div
        className={`row-actions ${compactActions ? "compact-inline-actions" : ""}`}
        aria-busy={busy}
      >
        <button
          type="button"
          className={`btn btn-success ${compactActions ? "btn-inline-action btn-inline-approve" : "btn-sm"}`}
          onClick={() =>
            runAction("approve", () => onDecision(item.id, "Approved"))
          }
          disabled={busy}
        >
          {pendingAction === "approve" ? (
            <span className="btn-spinner-wrap">
              <span className="btn-spinner" />
              <span>Approve</span>
            </span>
          ) : (
            "Approve"
          )}
        </button>
        <button
          type="button"
          className={`btn btn-danger ${compactActions ? "btn-inline-action btn-inline-reject" : "btn-sm"}`}
          onClick={() =>
            runAction("reject", async () => {
              const confirmed = window.confirm(
                "Reject this request? You will need to provide a reason in the next step.",
              );
              if (!confirmed) return;
              await onDecision(item.id, "Rejected");
            })
          }
          disabled={busy}
        >
          {pendingAction === "reject" ? (
            <span className="btn-spinner-wrap">
              <span className="btn-spinner" />
              <span>Reject</span>
            </span>
          ) : (
            "Reject"
          )}
        </button>
        {mode === "manager" && onEscalate ? (
          <button
            type="button"
            className={`btn btn-outline ${compactActions ? "btn-inline-action btn-inline-ghost" : "btn-sm"}`}
            onClick={() =>
              runAction("escalate", () => onEscalate(item.id))
            }
            disabled={busy}
          >
            {pendingAction === "escalate" ? (
              <span className="btn-spinner-wrap">
                <span className="btn-spinner" />
                <span>Esc</span>
              </span>
            ) : (
              "Esc"
            )}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <ActionMenu
      item={item}
      mode={mode}
      onWithdraw={onWithdraw}
      onDownload={onDownload}
      onEdit={onEdit}
    />
  );
});

const RequestTable = ({
  rows,
  canTakeAction,
  onDecision,
  onEscalate,
  page = 1,
  totalPages = 1,
  onPageChange,
  mode = "user",
  onWithdraw,
  onDownload,
  onEdit,
  hideActions = false,
  showPriority = false,
  selectable = false,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  tableVariant = "default",
  stickyActions = false,
}) => {
  const isApprovalsTable = tableVariant === "approvals";
  const showRequester = mode === "admin" || mode === "manager";
  const showIdColumn = !isApprovalsTable;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected =
    selectable && rows.length > 0 && rows.every((item) => selectedSet.has(item.id));
  if (!rows.length) {
    return <div className="table-empty">No matching records found.</div>;
  }

  return (
    <>
      <div
        className={`table-scroll ${isApprovalsTable ? "table-scroll-approvals" : ""}`}
      >
        <table
          className={`request-table ${isApprovalsTable ? "approvals-table" : ""}`}
        >
          <thead>
            <tr>
              {selectable ? (
                <th className="col-select">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => onSelectAll?.(rows, event.target.checked)}
                    aria-label="Select all rows"
                  />
                </th>
              ) : null}
              {showIdColumn ? <th className="col-id">Request ID</th> : null}
              <th className="col-title">
                {isApprovalsTable ? "Request" : "Request Title"}
              </th>
              {showRequester ? <th className="col-requester">User</th> : null}
              <th className="col-department">Department</th>
              {showPriority ? <th className="col-priority">Priority</th> : null}
              <th className="col-suggestion">Smart Suggestion</th>
              <th className="col-deadline">Deadline</th>
              <th className="col-status">Status</th>
              <th className="col-date">Submitted</th>
              {!hideActions ? (
                <th
                  className={`col-actions ${stickyActions ? "sticky-actions-col" : ""}`}
                >
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const deadline = item.deadlineMeta || getDeadlineMeta(item);
              const suggestion = getSmartApprovalSuggestion(item);
              const overdue = item.isOverdue || isOverdue(item);
              return (
              <tr key={item.id} className={overdue ? "row-overdue" : ""}>
                {selectable ? (
                  <td className="col-select">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(item.id)}
                      onChange={(event) => onToggleSelect?.(item.id, event.target.checked)}
                      aria-label={`Select request ${item.id}`}
                    />
                  </td>
                ) : null}
                {showIdColumn ? <td className="col-id">{item.id}</td> : null}
                <td className="request-title-cell col-title">
                  {isApprovalsTable ? (
                    <div className="approvals-title-wrap">
                      <small className="request-inline-id">{item.id}</small>
                      <Link to={detailPathFor(item.id, mode)}>{item.title}</Link>
                    </div>
                  ) : (
                    <Link to={detailPathFor(item.id, mode)}>{item.title}</Link>
                  )}
                </td>
                {showRequester ? (
                  <td className="col-requester">
                    <span className="cell-truncate">{item.requesterName}</span>
                  </td>
                ) : null}
                <td className="col-department">
                  <span className="cell-truncate">{item.department}</span>
                </td>
                {showPriority ? (
                  <td className="col-priority">
                    <span
                      className={`priority-badge priority-${String(item.priority || "medium").toLowerCase()}`}
                    >
                      {item.priority || "-"}
                    </span>
                  </td>
                ) : null}
                <td className="col-suggestion">
                  <span className={`suggestion-chip tone-${suggestion.tone}`}>
                    {suggestion.label} ({suggestion.confidence}%)
                  </span>
                </td>
                <td className="col-deadline">
                  <span className={`deadline-chip severity-${deadline.severity}`}>
                    {deadline.label}
                  </span>
                </td>
                <td className="col-status">
                  <StatusBadge status={item.status} />
                </td>
                <td className="col-date">
                  {new Date(item.submittedAt).toLocaleDateString()}
                </td>
                {!hideActions ? (
                  <td
                    className={`col-actions ${stickyActions ? "sticky-actions-col" : ""}`}
                  >
                    <RequestRowActions
                      item={item}
                      canTakeAction={canTakeAction}
                      onDecision={onDecision}
                      onEscalate={onEscalate}
                      mode={mode}
                      onWithdraw={onWithdraw}
                      onDownload={onDownload}
                      onEdit={onEdit}
                      compactActions={isApprovalsTable}
                    />
                  </td>
                ) : null}
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      <div
        className={`request-mobile-cards ${isApprovalsTable ? "approvals-mobile-cards" : ""}`}
      >
        {rows.map((item) => {
          const deadline = item.deadlineMeta || getDeadlineMeta(item);
          const suggestion = getSmartApprovalSuggestion(item);
          return (
            <article key={item.id} className={`mobile-request-card ${item.isOverdue ? "row-overdue" : ""}`}>
              <h4>
                <Link to={detailPathFor(item.id, mode)}>{item.title}</Link>
              </h4>
              <p>
                {item.id} | {item.department}{" "}
                {showPriority ? `| ${item.priority || "-"}` : ""}
              </p>
              <div className="mobile-request-meta">
                <StatusBadge status={item.status} />
                <span className={`suggestion-chip tone-${suggestion.tone}`}>
                  {suggestion.label}
                </span>
                <span className={`deadline-chip severity-${deadline.severity}`}>
                  {deadline.label}
                </span>
                {showRequester ? <span>{item.requesterName}</span> : null}
                <strong>{new Date(item.submittedAt).toLocaleDateString()}</strong>
              </div>
              {!hideActions ? (
                <RequestRowActions
                  item={item}
                  canTakeAction={canTakeAction}
                  onDecision={onDecision}
                  onEscalate={onEscalate}
                  mode={mode}
                  onWithdraw={onWithdraw}
                  onDownload={onDownload}
                  onEdit={onEdit}
                  compactActions={isApprovalsTable}
                />
              ) : null}
            </article>
          );
        })}
      </div>

      {totalPages > 1 ? (
        <div className="pagination">
          <button
            type="button"
            className="btn btn-outline"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-outline"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </>
  );
};

export default memo(RequestTable);

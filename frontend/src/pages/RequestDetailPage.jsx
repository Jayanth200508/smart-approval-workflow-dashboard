import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import ExportActions from "../components/common/ExportActions";
import StatusBadge from "../components/common/StatusBadge";
import ApprovalTimeline from "../components/requests/ApprovalTimeline";
import { useAuth } from "../context/AuthContext";
import { useRequests } from "../context/RequestContext";
import { addActivityLog, addRequestEvent } from "../services/workflowService";
import { getDeadlineMeta } from "../utils/requestInsights";

const formatDuration = (minutes = 0) => {
  const safe = Number(minutes || 0);
  if (!safe) return "-";
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (!hours) return `${mins} minute${mins === 1 ? "" : "s"}`;
  return `${hours} hour${hours === 1 ? "" : "s"} ${mins} minute${mins === 1 ? "" : "s"}`;
};

const RequestDetailPage = () => {
  const { requestId } = useParams();
  const { user } = useAuth();
  const { requests, refreshRequests } = useRequests();
  const request = requests.find((item) => item.id === requestId);
  const deadlineMeta = request ? getDeadlineMeta(request) : null;

  const renderAttachmentPreview = (file) => {
    const fileName = String(file || "");
    const lower = fileName.toLowerCase();
    const isImage = [".png", ".jpg", ".jpeg", ".gif", ".webp"].some((ext) =>
      lower.endsWith(ext),
    );
    const isPdf = lower.endsWith(".pdf");

    if (isImage || isPdf) {
      return (
        <div className="attachment-preview-card">
          <strong>{fileName}</strong>
          <small>
            {isImage ? "Image preview (sample)" : "PDF preview not embedded in mock mode"}
          </small>
        </div>
      );
    }

    return (
      <div className="attachment-preview-card">
        <strong>{fileName}</strong>
        <small>Preview unavailable. Download to inspect.</small>
      </div>
    );
  };

  useEffect(() => {
    if (!request || user?.role !== "admin") return;
    const markerKey = `flowpilot_viewed_${request.id}`;
    if (sessionStorage.getItem(markerKey)) return;
    addRequestEvent({
      requestId: request.id,
      action: "request_viewed",
      actorName: user.fullName,
      actorRole: "admin",
      status: request.status,
      comment: "Admin viewed request",
    });
    addActivityLog({
      userName: user.fullName,
      role: "admin",
      action: "Request viewed",
      requestId: request.id,
      status: request.status,
    });
    sessionStorage.setItem(markerKey, "1");
    refreshRequests();
  }, [request, user, refreshRequests]);

  if (!request) {
    return (
      <section className="page-stack">
        <article className="surface-card">
          <h3>Request not found</h3>
          <p>The requested approval record is not available.</p>
          <Link
            className="btn btn-primary"
            to={
              user?.role === "admin"
                ? "/admin/requests"
                : "/employee/my-requests"
            }
          >
            {user?.role === "admin"
              ? "Back to All Requests"
              : "Back to My Requests"}
          </Link>
        </article>
      </section>
    );
  }

  return (
    <section className="page-stack">
      <article className="surface-card fade-in">
        <div className="card-head">
          <h3>{request.title}</h3>
          <StatusBadge status={request.status} />
        </div>
        <div className="profile-grid">
          <div>
            <label>Requester</label>
            <p>{request.requesterName}</p>
          </div>
          <div>
            <label>Department</label>
            <p>{request.department}</p>
          </div>
          <div>
            <label>Type</label>
            <p>{request.type}</p>
          </div>
          <div>
            <label>Amount</label>
            <p>${Number(request.amount || 0).toLocaleString()}</p>
          </div>
          <div>
            <label>Priority</label>
            <p>{request.priority}</p>
          </div>
          <div>
            <label>Approver</label>
            <p>{request.approverName || "Unassigned"}</p>
          </div>
          <div>
            <label>Submission Date</label>
            <p>{new Date(request.submittedAt).toLocaleString()}</p>
          </div>
          <div>
            <label>Current Status</label>
            <p>{request.status}</p>
          </div>
          <div>
            <label>Decision Time</label>
            <p>{request.decidedAt ? new Date(request.decidedAt).toLocaleString() : "-"}</p>
          </div>
          <div>
            <label>Total Approval Time</label>
            <p>{formatDuration(request.approvalTimeMinutes)}</p>
          </div>
        </div>
        <div className="detail-description">
          <label>Description</label>
          <p>{request.description || "No description provided."}</p>
        </div>
        <div className="detail-description">
          <label>SLA Progress</label>
          <div className="sla-track">
            <span style={{ width: `${request.slaProgress || 0}%` }} />
          </div>
          <p>{request.slaProgress || 0}% elapsed</p>
        </div>
        <div className="detail-description">
          <label>Deadline Status</label>
          <p>
            <span className={`deadline-chip severity-${deadlineMeta?.severity || "normal"}`}>
              {deadlineMeta?.label || "No deadline"}
            </span>
          </p>
        </div>
        <div className="detail-description">
          <label>Attachments</label>
          {(request.attachments || []).length ? (
            <ul className="attachment-list">
              {request.attachments.map((file) => (
                <li key={file}>
                  <div className="attachment-item-row">
                    {renderAttachmentPreview(file)}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        const blob = new Blob(
                          [`Attachment placeholder for ${file}`],
                          { type: "text/plain;charset=utf-8" },
                        );
                        const url = URL.createObjectURL(blob);
                        const anchor = document.createElement("a");
                        anchor.href = url;
                        anchor.download = file;
                        document.body.appendChild(anchor);
                        anchor.click();
                        document.body.removeChild(anchor);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Download
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No attachments uploaded.</p>
          )}
        </div>
      </article>

      <article className="surface-card fade-in">
        <h3>Approval Timeline</h3>
        <ExportActions rows={[request]} fileName={`request-${request.id}`} />
        <ApprovalTimeline request={request} />
      </article>

      <article className="surface-card fade-in">
        <h3>Request Activity</h3>
        <div className="activity-timeline-rail">
          {(request.timeline || []).map((entry) => (
            <div
              key={`${entry.timestamp}-${entry.hash || entry.status}`}
              className="timeline-rail-item"
            >
              <span className="timeline-rail-dot" />
              <div>
                <strong>{entry.status}</strong>
                <p>{entry.comment || "Status updated"}</p>
                <small>
                  By {entry.actorName || entry.role || "System"} at{" "}
                  {new Date(entry.timestamp).toLocaleString()}
                </small>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
};

export default RequestDetailPage;

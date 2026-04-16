import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useRequests } from "../context/RequestContext";
import {
  getWorkflowBottlenecks,
  rerouteWorkflowRequest,
  runWorkflowMonitor,
} from "../services/intelligenceService";

const WorkflowOpsPage = () => {
  const { user } = useAuth();
  const { requests, refreshRequests } = useRequests();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await getWorkflowBottlenecks(requests);
      setData(payload);
    } catch (loadError) {
      setError(loadError.message || "Failed to load workflow operations data");
    } finally {
      setLoading(false);
    }
  }, [requests]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      load();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  const realtime = useMemo(
    () =>
      data?.realtimeStatus || {
        queueHealth: "healthy",
        openQueue: 0,
        overloadRatio: 0,
        avgPendingHours: 0,
      },
    [data],
  );

  const runMonitorNow = async (dryRun) => {
    setActionMessage("");
    try {
      const result = await runWorkflowMonitor(dryRun);
      setActionMessage(
        `Monitor completed. Escalated ${result.escalatedCount} and rerouted ${result.reroutedCount}.`,
      );
      await refreshRequests();
      await load();
    } catch (actionError) {
      setActionMessage(actionError.message || "Failed to run monitor");
    }
  };

  const rerouteNow = async (requestId) => {
    setActionMessage("");
    try {
      const result = await rerouteWorkflowRequest(
        requestId,
        "Manual reroute from workflow operations dashboard",
      );
      setActionMessage(
        `Request ${result.requestTitle} rerouted to ${result.nextApproverName}.`,
      );
      await refreshRequests();
      await load();
    } catch (actionError) {
      setActionMessage(actionError.message || "Unable to reroute request");
    }
  };

  if (!["manager", "admin"].includes(user?.role || "")) {
    return (
      <section className="page-stack">
        <article className="surface-card fade-in">
          <h3>Workflow Operations Access Required</h3>
          <p>This page is available for manager/admin users only.</p>
        </article>
      </section>
    );
  }

  return (
    <section className="page-stack">
      <motion.article
        className="surface-card workflow-ops-head"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div>
          <p className="prediction-eyebrow">Smart Adaptive Workflow Rerouting</p>
          <h3>Workflow Operations Center</h3>
          <p className="muted-line">
            Real-time bottleneck detection, alternate approver suggestions, and
            escalation monitoring.
          </p>
        </div>
        <div className="workflow-ops-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => runMonitorNow(true)}
          >
            Run Dry Monitor
          </button>
          {user?.role === "admin" ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => runMonitorNow(false)}
            >
              Run Auto Escalation
            </button>
          ) : null}
        </div>
      </motion.article>

      {actionMessage ? <div className="submit-success">{actionMessage}</div> : null}
      {error ? <div className="inline-error">{error}</div> : null}

      <div className="metrics-grid">
        <article className="surface-card">
          <span className="muted-line">Queue Health</span>
          <h3 className={`queue-health-${realtime.queueHealth}`}>{realtime.queueHealth}</h3>
          <p className="muted-line">Open queue: {realtime.openQueue}</p>
        </article>
        <article className="surface-card">
          <span className="muted-line">Overload Ratio</span>
          <h3>{(Number(realtime.overloadRatio || 0) * 100).toFixed(1)}%</h3>
          <p className="muted-line">Across manager/admin capacity</p>
        </article>
        <article className="surface-card">
          <span className="muted-line">Average Pending Age</span>
          <h3>{Number(realtime.avgPendingHours || 0).toFixed(1)}h</h3>
          <p className="muted-line">Stale request pressure indicator</p>
        </article>
      </div>

      {loading ? (
        <div className="skeleton-grid">
          <div className="skeleton-item" />
          <div className="skeleton-item" />
        </div>
      ) : (
        <>
          <article className="surface-card">
            <h3>Escalation Alerts</h3>
            {(data?.escalationAlerts || []).length ? (
              <div className="workflow-ops-list">
                {data.escalationAlerts.map((item) => (
                  <div key={item.requestId} className={`workflow-ops-item ${item.severity}`}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.message}</p>
                    </div>
                    <span>{item.pendingHours.toFixed(1)}h</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-line">No escalation alerts at the moment.</p>
            )}
          </article>

          <article className="surface-card">
            <h3>Suggested Alternate Approvers</h3>
            {(data?.suggestedReroutes || []).length ? (
              <div className="workflow-ops-list">
                {data.suggestedReroutes.map((item) => (
                  <div key={item.requestId} className="workflow-ops-item">
                    <div>
                      <strong>{item.requestTitle}</strong>
                      <p>
                        {item.currentApprover} -> {item.suggestedApprover || "No alternate"}
                      </p>
                      <small>
                        Confidence: {Number(item.confidence || 0).toFixed(1)}% | Pending: {Number(item.pendingHours || 0).toFixed(1)}h
                      </small>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={!item.suggestedApproverId}
                        onClick={() => rerouteNow(item.requestId)}
                      >
                        Reroute
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-line">No reroute recommendations currently.</p>
            )}
          </article>

          <article className="surface-card">
            <h3>Overloaded Approvers</h3>
            {(data?.overloadedApprovers || []).length ? (
              <div className="workflow-ops-list compact">
                {data.overloadedApprovers.map((item) => (
                  <div key={item.approverId} className="workflow-ops-item">
                    <strong>{item.approverName}</strong>
                    <span>{item.pendingCount} pending</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-line">No overload detected.</p>
            )}
          </article>
        </>
      )}
    </section>
  );
};

export default WorkflowOpsPage;
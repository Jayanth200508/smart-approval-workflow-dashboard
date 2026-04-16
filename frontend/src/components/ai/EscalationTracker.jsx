const EscalationTracker = ({ escalations = [] }) => {
  return (
    <article className="surface-card escalation-tracker-card">
      <div className="ai-card-head">
        <p className="prediction-eyebrow">Smart Escalation Tracker</p>
        <h4>Escalation History</h4>
      </div>
      {escalations.length ? (
        <div className="workflow-ops-list compact">
          {escalations.map((item) => (
            <div key={item.id || item.requestId} className="workflow-ops-item">
              <div>
                <strong>{item.reason || "Escalated"}</strong>
                <p>
                  {item.fromApprover || "Unassigned"} {"->"}{" "}
                  {item.toApprover || "Unassigned"}
                </p>
                <small>
                  {item.escalatedAt
                    ? new Date(item.escalatedAt).toLocaleString()
                    : "-"}
                </small>
              </div>
              <span>{item.autoEscalated ? "Auto" : "Manual"}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted-line">No escalations recorded yet.</p>
      )}
    </article>
  );
};

export default EscalationTracker;

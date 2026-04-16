const heatClass = (hours) => {
  if (hours >= 72) return "critical";
  if (hours >= 36) return "warning";
  return "normal";
};

const BottleneckHeatmap = ({ rows = [] }) => {
  return (
    <article className="surface-card bottleneck-heatmap-card">
      <div className="ai-card-head">
        <p className="prediction-eyebrow">Bottleneck Detection</p>
        <h4>Approver / Department Heatmap</h4>
      </div>

      {rows.length ? (
        <div className="bottleneck-heatmap-list">
          {rows.slice(0, 12).map((row) => (
            <div key={`${row.requestId}-${row.approverName}`} className="heatmap-row">
              <div>
                <strong>{row.title}</strong>
                <p>
                  {row.department} | {row.approverName}
                </p>
              </div>
              <span className={`heat-chip ${heatClass(Number(row.pendingHours || 0))}`}>
                {Number(row.pendingHours || 0).toFixed(1)}h
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted-line">No active bottlenecks right now.</p>
      )}
    </article>
  );
};

export default BottleneckHeatmap;

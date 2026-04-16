const AIRiskCard = ({ prediction }) => {
  const riskScore = Number(prediction?.aiRiskScore || prediction?.riskScore || 0);
  const riskLevel = prediction?.riskLevel || "Low";
  const warningMessage = prediction?.warningMessage || "";

  return (
    <article className="surface-card ai-risk-card">
      <div className="ai-card-head">
        <p className="prediction-eyebrow">AI Risk Insight</p>
        <h4>Rejection Risk</h4>
      </div>

      <div className="ai-risk-meter">
        <strong>{riskScore.toFixed(1)} / 100</strong>
        <span className={`risk-pill ${riskLevel.toLowerCase()}`}>{riskLevel}</span>
      </div>

      <div className="prediction-track ai-track">
        <i style={{ width: `${Math.min(100, Math.max(0, riskScore))}%` }} />
      </div>

      {warningMessage ? (
        <p className="inline-error ai-warning-text">{warningMessage}</p>
      ) : (
        <p className="muted-line">
          No critical rejection signals detected from current request details.
        </p>
      )}
    </article>
  );
};

export default AIRiskCard;

import { motion } from "framer-motion";

const PredictionCard = ({ prediction, loading, error }) => {
  const approvalChance = Number(prediction?.approvalChance || 0);
  const confidence = Number(prediction?.confidenceScore || 0);

  return (
    <motion.article
      className="surface-card prediction-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="prediction-card-head">
        <div>
          <p className="prediction-eyebrow">Predictive Approval Intelligence</p>
          <h4>Pre-Submission Decision Forecast</h4>
        </div>
        {loading ? <span className="prediction-chip">Analyzing...</span> : null}
      </div>

      {error ? <p className="inline-error">{error}</p> : null}

      <div className="prediction-metric-grid">
        <div className="prediction-metric">
          <span>Approval Chance</span>
          <strong>{approvalChance.toFixed(1)}%</strong>
          <div className="prediction-track">
            <i style={{ width: `${approvalChance}%` }} />
          </div>
        </div>
        <div className="prediction-metric">
          <span>Confidence Score</span>
          <strong>{confidence.toFixed(1)}%</strong>
          <div className="prediction-track confidence">
            <i style={{ width: `${confidence}%` }} />
          </div>
        </div>
        <div className="prediction-metric">
          <span>Estimated Time</span>
          <strong>{Number(prediction?.estimatedApprovalHours || 0).toFixed(1)}h</strong>
          <small>{Number(prediction?.estimatedApprovalDays || 0).toFixed(2)} day(s)</small>
        </div>
        <div className="prediction-metric">
          <span>Bottleneck Risk</span>
          <strong>{prediction?.bottleneckRisk || "Low"}</strong>
          <small>{Number(prediction?.rejectionChance || 0).toFixed(1)}% rejection chance</small>
        </div>
      </div>

      {Array.isArray(prediction?.bottleneckSignals) && prediction.bottleneckSignals.length ? (
        <div className="prediction-alert-list">
          {prediction.bottleneckSignals.slice(0, 3).map((signal) => (
            <p key={signal}>{signal}</p>
          ))}
        </div>
      ) : null}

      <div className="prediction-grid-2">
        <div>
          <h5>Suggested Documents</h5>
          <ul>
            {(prediction?.suggestedDocuments || []).slice(0, 5).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h5>Missing Fields</h5>
          <ul>
            {(prediction?.missingFields || []).length ? (
              (prediction?.missingFields || []).slice(0, 5).map((item) => (
                <li key={item}>{item.replaceAll("_", " ")}</li>
              ))
            ) : (
              <li>None detected</li>
            )}
          </ul>
        </div>
      </div>
    </motion.article>
  );
};

export default PredictionCard;
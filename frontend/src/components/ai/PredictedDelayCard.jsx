const PredictedDelayCard = ({ prediction }) => {
  const delayHours = Number(
    prediction?.predictedDelayHours || prediction?.predictedDelay || 0,
  );
  const completionDate = prediction?.predictedCompletionDate
    ? new Date(prediction.predictedCompletionDate)
    : null;

  return (
    <article className="surface-card ai-delay-card">
      <div className="ai-card-head">
        <p className="prediction-eyebrow">AI Delay Prediction</p>
        <h4>Estimated Completion</h4>
      </div>

      <div className="ai-delay-metrics">
        <div>
          <span>Predicted Delay</span>
          <strong>{delayHours.toFixed(1)}h</strong>
        </div>
        <div>
          <span>ETA</span>
          <strong>
            {completionDate
              ? completionDate.toLocaleString()
              : "Not available"}
          </strong>
        </div>
      </div>
    </article>
  );
};

export default PredictedDelayCard;

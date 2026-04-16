const SmartSuggestionsPanel = ({ prediction }) => {
  const missingDocuments = prediction?.missingDocuments || [];
  const requiredDocuments = prediction?.requiredDocuments || [];
  const routeSuggestions = prediction?.smartRouteRecommendation || [];
  const bottleneckWarnings = prediction?.bottleneckWarnings || [];

  return (
    <article className="surface-card ai-suggestions-panel">
      <div className="ai-card-head">
        <p className="prediction-eyebrow">Smart Suggestions</p>
        <h4>Pre-Submission Guidance</h4>
      </div>

      <div className="ai-suggestion-grid">
        <section>
          <h5>Missing Documents</h5>
          <ul>
            {missingDocuments.length ? (
              missingDocuments.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>None detected</li>
            )}
          </ul>
        </section>

        <section>
          <h5>Required Documents</h5>
          <ul>
            {requiredDocuments.length ? (
              requiredDocuments.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>No mandatory documents inferred yet</li>
            )}
          </ul>
        </section>

        <section>
          <h5>Alternate Approver Suggestions</h5>
          <ul>
            {routeSuggestions.length ? (
              routeSuggestions.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>No alternate route recommendation currently</li>
            )}
          </ul>
        </section>

        <section>
          <h5>Bottleneck Warnings</h5>
          <ul>
            {bottleneckWarnings.length ? (
              bottleneckWarnings.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>No active bottleneck warning</li>
            )}
          </ul>
        </section>
      </div>
    </article>
  );
};

export default SmartSuggestionsPanel;

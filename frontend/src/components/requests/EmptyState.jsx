const EmptyState = ({ onCreate }) => (
  <article className="empty-state surface-card fade-in">
    <div className="empty-illustration" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
    <h3>No requests yet</h3>
    <p>
      Create your first approval request to start tracking status, SLA, and
      decisions.
    </p>
    <button type="button" className="btn btn-primary" onClick={onCreate}>
      Create First Request
    </button>
  </article>
);

export default EmptyState;

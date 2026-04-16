const readableStatus = (value = "") =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const statusTone = (status) => {
  if (status === "approved") return "success";
  if (status === "rejected") return "error";
  if (status === "admin_review") return "warning";
  return "";
};

const ApprovalTimeline = ({ request }) => {
  const timeline = (request.timeline || []).length
    ? request.timeline
    : [
        {
          status: "submission",
          comment: "Request created by requester.",
          timestamp: request.submittedAt,
        },
      ];

  return (
    <section className="timeline-wrap" aria-label="Approval timeline">
      {timeline.map((entry, index) => (
        <article
          key={`${entry.timestamp}-${entry.status}-${index}`}
          className="timeline-item complete"
        >
          <div className={`timeline-dot ${statusTone(entry.status)}`}>
            {index + 1}
          </div>
          {index < timeline.length - 1 ? (
            <div className="timeline-line" />
          ) : null}
          <div className="timeline-content">
            <h4>{readableStatus(entry.status)}</h4>
            <small>{new Date(entry.timestamp).toLocaleString()}</small>
            <p>{entry.comment || "No additional comment provided."}</p>
            {entry.actorName ? <p>{entry.actorName}</p> : null}
          </div>
        </article>
      ))}
    </section>
  );
};

export default ApprovalTimeline;

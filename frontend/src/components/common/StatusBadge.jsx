const StatusBadge = ({ status }) => {
  const state = String(status || "pending")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return (
    <span
      className={`status-badge status-${state}`}
      aria-label={`Status ${status}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;

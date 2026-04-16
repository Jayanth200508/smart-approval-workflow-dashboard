const iconMap = {
  total: (
    <path
      d="M4 6.5A2.5 2.5 0 0 1 6.5 4h3A2.5 2.5 0 0 1 12 6.5v3A2.5 2.5 0 0 1 9.5 12h-3A2.5 2.5 0 0 1 4 9.5v-3zm8 0A2.5 2.5 0 0 1 14.5 4h3A2.5 2.5 0 0 1 20 6.5v1A2.5 2.5 0 0 1 17.5 10h-3A2.5 2.5 0 0 1 12 7.5v-1zm0 8A2.5 2.5 0 0 1 14.5 12h3a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5h-3a2.5 2.5 0 0 1-2.5-2.5v-3zM4 15.5A2.5 2.5 0 0 1 6.5 13h3a2.5 2.5 0 0 1 2.5 2.5v2A2.5 2.5 0 0 1 9.5 20h-3A2.5 2.5 0 0 1 4 17.5v-2z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  pending: (
    <path
      d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
      strokeLinecap="round"
    />
  ),
  approved: (
    <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
  ),
  rejected: <path d="m7 7 10 10m0-10L7 17" strokeLinecap="round" />,
};

const StatCard = ({ label, value, helper, trend = "", icon = "total" }) => (
  <article className="metric-card fade-in">
    <div className="metric-head">
      <p>{label}</p>
      <span className="metric-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          {iconMap[icon] || iconMap.total}
        </svg>
      </span>
    </div>
    <h3>{value}</h3>
    <div className="metric-foot">
      {trend ? (
        <span
          className={`metric-trend ${trend.startsWith("-") ? "down" : "up"}`}
        >
          {trend}
        </span>
      ) : (
        <span />
      )}
      <small>{helper}</small>
    </div>
  </article>
);

export default StatCard;

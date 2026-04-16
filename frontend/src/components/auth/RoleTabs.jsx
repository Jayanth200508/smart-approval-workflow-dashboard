const RoleTabs = ({ portal, onSwitch }) => (
  <div className="enterprise-role-tabs" role="tablist" aria-label="Login Role">
    <button
      type="button"
      role="tab"
      aria-selected={portal === "employee"}
      className={`enterprise-role-tab ${portal === "employee" ? "active" : ""}`}
      onClick={() => onSwitch("employee")}
    >
      Employee Login
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={portal === "admin"}
      className={`enterprise-role-tab ${portal === "admin" ? "active" : ""}`}
      onClick={() => onSwitch("admin")}
    >
      Admin Login
    </button>
  </div>
);

export default RoleTabs;


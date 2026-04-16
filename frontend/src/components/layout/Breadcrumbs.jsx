import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getHomeRouteByRole } from "../../utils/roleUtils";

const labelMap = {
  dashboard: "Dashboard",
  "submit-request": "Submit Request",
  "my-requests": "My Requests",
  "admin-dashboard": "Admin Dashboard",
  "all-requests": "All Requests",
  users: "Users",
  departments: "Departments",
  "activity-logs": "Activity Logs",
  announcements: "Announcements",
  notifications: "Notifications",
  "ai-analytics": "AI Analytics",
  profile: "Profile",
  "help-support": "Help / Support",
  admin: "Admin",
  requests: "Request Detail",
};

const Breadcrumbs = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const parts = pathname.split("/").filter(Boolean);
  const homeRoute = getHomeRouteByRole(user?.role);

  if (!parts.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <Link to={homeRoute}>Home</Link>
      {parts.map((part, index) => {
        const href = `/${parts.slice(0, index + 1).join("/")}`;
        const label = labelMap[part] || part;
        const last = index === parts.length - 1;
        return (
          <span key={href} className="crumb">
            <i>/</i>
            {last ? <strong>{label}</strong> : <Link to={href}>{label}</Link>}
          </span>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;

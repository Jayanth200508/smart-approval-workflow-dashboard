import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getHomeRouteByRole } from "../../utils/roleUtils";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, isBootstrapping, user } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return <div className="page-loading">Loading session...</div>;
  }

  if (!isAuthenticated) {
    const loginPath = location.pathname.startsWith("/admin")
      ? "/admin/login"
      : "/employee/login";
    return (
      <Navigate to={loginPath} state={{ from: location.pathname }} replace />
    );
  }

  if (Array.isArray(allowedRoles) && !allowedRoles.includes(user?.role)) {
    return <Navigate to={getHomeRouteByRole(user?.role)} replace />;
  }

  return children;
};

export default ProtectedRoute;

import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import LoginCard from "../components/auth/LoginCard";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/images/flowpilot-logo.svg";
import { getHomeRouteByRole } from "../utils/roleUtils";

const EMAIL_HINT_KEY = "flowpilot_remembered_email";

const LoginPage = ({ portal = "employee" }) => {
  const { user, login, logout, authError, clearAuthError, isAuthenticated } =
    useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [rememberMe, setRememberMe] = useState(
    Boolean(localStorage.getItem(EMAIL_HINT_KEY)),
  );
  const [form, setForm] = useState({
    email: localStorage.getItem(EMAIL_HINT_KEY) || "",
    password: "",
  });

  const errors = useMemo(() => {
    const next = { email: "", password: "" };
    if (
      form.email.includes("@") &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    ) {
      next.email = "Please enter a valid email address.";
    }
    if (form.password && form.password.length < 6) {
      next.password = "Password must be at least 6 characters.";
    }
    return next;
  }, [form.email, form.password]);

  const hasPortalSession =
    isAuthenticated &&
    (portal === "admin"
      ? user?.role === "admin"
      : ["employee", "manager"].includes(user?.role || ""));
  const hasDifferentPortalSession = isAuthenticated && !hasPortalSession;

  if (hasPortalSession)
    return <Navigate to={getHomeRouteByRole(user?.role)} replace />;

  const switchPortal = (nextPortal) => {
    if (nextPortal === portal) return;
    navigate(nextPortal === "admin" ? "/admin/login" : "/employee/login");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    clearAuthError();
    setLocalError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (errors.email || errors.password) return;
    setLoading(true);
    try {
      const nextUser = await login(form);
      if (
        portal === "employee" &&
        !["employee", "manager"].includes(nextUser.role)
      ) {
        logout();
        setLocalError("Admin accounts must sign in from the Admin Portal.");
        return;
      }
      if (portal === "admin" && nextUser.role !== "admin") {
        logout();
        setLocalError("Only admin accounts can access the Admin Portal.");
        return;
      }
      if (rememberMe) localStorage.setItem(EMAIL_HINT_KEY, form.email);
      else localStorage.removeItem(EMAIL_HINT_KEY);

      if (portal === "admin") navigate("/admin/dashboard", { replace: true });
      else
        navigate(location.state?.from || "/employee/dashboard", {
          replace: true,
        });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`enterprise-login-page portal-${portal}`}>
      <section className="enterprise-login-shell">
        <aside className="enterprise-login-left">
          <div className="enterprise-grid-pattern" aria-hidden="true" />
          <div className="enterprise-brand-content fade-in">
            <span className="enterprise-pill">
              {portal === "admin" ? "Admin Portal" : "Employee Portal"}
            </span>
            <img
              src={logo}
              alt="Infosys Approval System"
              className="enterprise-brand-logo"
            />
            <h1>Infosys Approval System</h1>
            <p className="enterprise-brand-subtitle">
              Enterprise Workflow Management Platform
            </p>
            <p className="enterprise-brand-description">
              Review, approve, and track organizational requests with a clean,
              audit-ready workflow.
            </p>
          </div>
        </aside>

        <LoginCard
          portal={portal}
          onSwitchPortal={switchPortal}
          form={form}
          errors={errors}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((prev) => !prev)}
          onChange={handleChange}
          onSubmit={handleSubmit}
          loading={loading}
          rememberMe={rememberMe}
          onRememberMeChange={setRememberMe}
          hasDifferentPortalSession={hasDifferentPortalSession}
          userRole={user?.role}
          onLogout={logout}
          localError={localError}
          authError={authError}
        />
      </section>
      <footer className="enterprise-login-footer">
        {"\u00A9"} 2026 Infosys Approval System
      </footer>
    </div>
  );
};

export default LoginPage;



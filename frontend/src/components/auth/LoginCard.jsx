import InputField from "../ui/InputField";
import RoleTabs from "./RoleTabs";

const LoginCard = ({
  portal,
  onSwitchPortal,
  form,
  errors,
  showPassword,
  onTogglePassword,
  onChange,
  onSubmit,
  loading,
  rememberMe,
  onRememberMeChange,
  hasDifferentPortalSession,
  userRole,
  onLogout,
  localError,
  authError,
}) => {
  const isAdmin = portal === "admin";

  return (
    <section className="enterprise-login-right">
      <div className="enterprise-login-card">
        <div className="enterprise-login-head">
          <h2>{isAdmin ? "Admin Access" : "Welcome Back"}</h2>
          <p>
            {isAdmin
              ? "Sign in to manage users, workflows, and system analytics."
              : "Sign in to submit and track approval requests."}
          </p>
        </div>

        <RoleTabs portal={portal} onSwitch={onSwitchPortal} />

        <form className="enterprise-auth-form" onSubmit={onSubmit}>
          {hasDifferentPortalSession ? (
            <div className="inline-error inline-warning">
              Signed in as {userRole}. Switch account to access this portal.
            </div>
          ) : null}

          <InputField
            label={isAdmin ? "Admin Email or Username" : "Employee Email or ID"}
            error={errors.email}
          >
            <input
              type="text"
              name="email"
              placeholder={isAdmin ? "admin@company.com" : "employee@company.com"}
              value={form.email}
              onChange={onChange}
              autoComplete="username"
              required
            />
          </InputField>

          <InputField label="Password" error={errors.password}>
            <div className="enterprise-password-row">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={onChange}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="enterprise-password-toggle"
                onClick={onTogglePassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </InputField>

          <div className="enterprise-auth-aux">
            <label className="remember-me-row" htmlFor="remember-me-enterprise">
              <input
                id="remember-me-enterprise"
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => onRememberMeChange(event.target.checked)}
              />
              <span className="remember-me-label">Remember me</span>
            </label>
            <button
              type="button"
              className="enterprise-forgot-link"
              onClick={() => window.alert("Please contact administrator to reset your password.")}
            >
              Forgot Password?
            </button>
          </div>

          {localError ? <div className="inline-error inline-critical">{localError}</div> : null}
          {authError ? <div className="inline-error inline-critical">{authError}</div> : null}

          <button
            type="submit"
            className="enterprise-login-btn"
            disabled={loading || Boolean(errors.email || errors.password)}
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>

          {hasDifferentPortalSession ? (
            <button type="button" className="btn btn-outline btn-full" onClick={onLogout}>
              Logout and Switch Account
            </button>
          ) : null}
        </form>
      </div>
    </section>
  );
};

export default LoginCard;


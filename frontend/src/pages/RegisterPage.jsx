import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getHomeRouteByRole } from "../utils/roleUtils";

const RegisterPage = () => {
  const { user, register, authError, clearAuthError, isAuthenticated } =
    useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    department: "Software Development",
  });

  if (isAuthenticated)
    return <Navigate to={getHomeRouteByRole(user?.role)} replace />;

  const handleChange = (event) => {
    const { name, value } = event.target;
    clearAuthError();
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const nextUser = await register({ ...form, role: "employee" });
      navigate(getHomeRouteByRole(nextUser.role), { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-backdrop" aria-hidden="true" />
      <section className="login-panel fade-in">
        <div className="login-heading">
          <h1>Create Account</h1>
          <p>
            Create an employee account to submit and track approval requests.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            <span>Full Name</span>
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            <span>Email Address</span>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              name="password"
              minLength={6}
              value={form.password}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            <span>Department</span>
            <input
              name="department"
              value={form.department}
              onChange={handleChange}
              required
            />
          </label>

          {authError ? <div className="inline-error">{authError}</div> : null}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </div>
  );
};

export default RegisterPage;

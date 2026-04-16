import { Link } from "react-router-dom";

const NotFoundPage = () => (
  <div className="login-page">
    <div className="login-backdrop" aria-hidden="true" />
    <div className="login-panel">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
      <Link className="btn btn-primary" to="/employee/dashboard">
        Go to Dashboard
      </Link>
    </div>
  </div>
);

export default NotFoundPage;

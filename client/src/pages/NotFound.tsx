import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="auth-wrap">
      <div className="card center">
        <h1>404</h1>
        <p className="muted">This page could not be found.</p>
        <Link to="/" className="btn">
          Go home
        </Link>
      </div>
    </div>
  );
}

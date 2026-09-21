import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="nav">
      <Link to="/" className="brand">
        <span className="brand-mark">🧠</span> TeamBrain
      </Link>
      <nav className="nav-links">
        {user ? (
          <>
            <span className="pill">{user.name}</span>
            <button
              className="btn ghost"
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register" className="btn">
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { Role } from "../types";
import { useAuth } from "../context/AuthContext";

/** Guards a route: requires authentication, and optionally a specific role. */
export function ProtectedRoute({ children, role }: { children: ReactNode; role?: Role }) {
  const { user, status } = useAuth();

  if (status !== "authed" || !user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    return (
      <div className="card">
        <h2>403 — Forbidden</h2>
        <p className="muted">
          This page requires the <strong>{role}</strong> role. You are signed in as{" "}
          <strong>{user.role}</strong>.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

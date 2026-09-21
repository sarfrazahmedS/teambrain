import { Route, Routes } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { DemoBanner } from "./components/DemoBanner";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { IS_DEMO } from "./api/client";
import { useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Workspace } from "./pages/Workspace";
import { NotFound } from "./pages/NotFound";

export default function App() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <>
        {IS_DEMO && <DemoBanner />}
        <div className="screen-center muted">Loading…</div>
      </>
    );
  }

  return (
    <>
      {IS_DEMO && <DemoBanner />}
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Workspace />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

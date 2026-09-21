import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { IS_DEMO } from "./api/client";
import { seedSessionFromQuery } from "./api/demo";
import App from "./App";
import "./styles.css";

// The static demo is hosted under a GitHub Pages sub-path, so it uses a
// HashRouter (deep links and refresh work with no server rewrite rules).
// The real app is served from the root and uses clean BrowserRouter URLs.
const Router = IS_DEMO ? HashRouter : BrowserRouter;

// Demo-only: honour a `?demo_as=demo` deep link (pre-seed the demo session)
// before the app mounts, so a link can open straight into the workspace.
if (IS_DEMO) seedSessionFromQuery();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  </StrictMode>,
);

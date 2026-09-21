import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the client calls "/api" and Vite proxies it to the backend,
// so cookies are same-origin and there are no CORS headaches.
//
// `base` is "/" for normal builds; the static demo sets VITE_BASE (e.g.
// "/teambrain/") so assets resolve under the GitHub Pages sub-path.
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});

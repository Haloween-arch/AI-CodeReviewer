import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 🚀 All analysis requests -> API Gateway (FastAPI)
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },

      // OPTIONAL: direct microservice debugging (if needed)
      "/svc/syntax": {
        target: "http://127.0.0.1:8002",
        rewrite: (p) => p.replace(/^\/svc\/syntax/, ""),
      },
      "/svc/style": {
        target: "http://127.0.0.1:8001",
        rewrite: (p) => p.replace(/^\/svc\/style/, ""),
      },
      "/svc/security": {
        target: "http://127.0.0.1:8003",
        rewrite: (p) => p.replace(/^\/svc\/security/, ""),
      },
      "/svc/quality": {
        target: "http://127.0.0.1:8004",
        rewrite: (p) => p.replace(/^\/svc\/quality/, ""),
      },
      "/svc/rule": {
        target: "http://127.0.0.1:8006",
        rewrite: (p) => p.replace(/^\/svc\/rule/, ""),
      },
      "/svc/report": {
        target: "http://127.0.0.1:8007",
        rewrite: (p) => p.replace(/^\/svc\/report/, ""),
      },

      // 🚀 NEW — MongoDB Analytics Microservice (future)
      "/history": {
        target: "http://127.0.0.1:8008",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/history/, ""),
      },
    },
  },
});

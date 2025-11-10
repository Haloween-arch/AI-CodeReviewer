import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api/syntax": {
        target: "http://127.0.0.1:8002",
        rewrite: (p) => p.replace("/api/syntax", ""),
      },
      "/api/style": {
        target: "http://127.0.0.1:8001",
        rewrite: (p) => p.replace("/api/style", ""),
      },
      "/api/security": {
        target: "http://127.0.0.1:8003",
        rewrite: (p) => p.replace("/api/security", ""),
      },
      "/api/quality": {
        target: "http://127.0.0.1:8004",
        rewrite: (p) => p.replace("/api/quality", ""),
      },
      "/api/rule": {
        target: "http://127.0.0.1:8006",
        rewrite: (p) => p.replace("/api/rule", ""),
      },
      "/api/report": {
        target: "http://127.0.0.1:8007",
        rewrite: (p) => p.replace("/api/report", ""),
      },
    },
  },
});

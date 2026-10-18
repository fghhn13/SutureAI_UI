import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Vendor code changes rarely, so it caches across app deploys.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          motion: ["motion/react"],
        },
      },
    },
  },
  server: {
    proxy: {
      // FastAPI backend (server/); same-origin in the browser so the session cookie just works.
      "/api": {
        target: process.env.SUTURE_API_URL ?? "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});

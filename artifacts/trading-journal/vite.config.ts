import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
    host: true,
  },
});

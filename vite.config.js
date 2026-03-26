import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/auth": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      external: (id) => {
        // Never bundle server-only packages
        const serverPkgs = ["better-sqlite3", "express", "express-session", "node-fetch", "compression", "connect-sqlite3", "dotenv", "cors"];
        if (serverPkgs.some(p => id === p || id.startsWith(p + "/"))) return true;
        return false;
      },
    },
  },
});

import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // GitHub Pages project site uses /dan/; Cloudflare/root stays /.
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    env: {
      // Unit tests always use demo adapter; ignore developer .env.local Supabase mode.
      VITE_DATA_MODE: "demo",
      VITE_DAN_DATA_MODE: "demo",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
    },
  },
});

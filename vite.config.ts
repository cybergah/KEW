import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Kew — Cybergah Group. Build output goes to dist/, which Capacitor copies
// into the Android assets at sync time.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1500,
  },
});

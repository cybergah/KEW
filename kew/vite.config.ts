/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Kew — Cybergah Group. Build output goes to dist/, which Capacitor copies
// into the Android assets at sync time.
//
// The UI lives in ../shared (common to Android and Windows); "@native" is this
// build's platform bridge.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@shared": r("../shared"),
      "@native": r("./src/native.ts"),
    },
    // ../shared has no node_modules of its own — resolve these from here.
    dedupe: ["react", "react-dom", "lucide-react", "simple-icons"],
  },
  server: { fs: { allow: [r("..")] } },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1500,
  },
  test: {
    dir: r("../shared"),
    environment: "node",
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Kew for Windows (Electron renderer). Cybergah Group.
// base "./" so assets resolve under file:// when loaded by Electron.
//
// The UI lives in ../shared (common to Android and Windows); "@native" is this
// build's Electron bridge.
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
  build: { outDir: "dist", chunkSizeWarningLimit: 1500 },
});

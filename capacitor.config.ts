import type { CapacitorConfig } from "@capacitor/cli";

// Kew — keklik. Anonymous & free video downloader.
// Cybergah Group · cybergah.com
const config: CapacitorConfig = {
  appId: "com.cybergah.kew",
  appName: "Kew",
  webDir: "dist",
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;

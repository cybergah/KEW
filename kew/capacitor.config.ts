import type { CapacitorConfig } from "@capacitor/cli";

// Kew — keklik. Anonymous & free video downloader.
// Cybergah Group · cybergah.com
const config: CapacitorConfig = {
  appId: "com.cybergah.kew",
  appName: "Kew",
  webDir: "dist",
  android: {
    allowMixedContent: true,
    // targetSdk 35 makes Android 15 draw the app under the system bars.
    // "auto" keeps the WebView between the bars, as before.
    adjustMarginsForEdgeToEdge: "auto",
  },
  server: {
    androidScheme: "https",
  },
};

export default config;

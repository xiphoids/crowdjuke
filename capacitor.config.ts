import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.crowdjuke.app",
  appName: "CrowdJuke",
  // Capacitor loads the remote server instead of bundled assets, so the
  // Next.js app runs as-is (SSR, InstantDB, etc.) inside the native WebView.
  server: {
    url: process.env.CAPACITOR_SERVER_URL || "http://localhost:3000",
    cleartext: true,
  },
  ios: {
    scheme: "CrowdJuke",
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;

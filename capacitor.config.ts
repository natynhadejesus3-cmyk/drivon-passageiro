import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.drivon.passageiro",
  appName: "Drivon Passageiro",
  webDir: "dist",
  android: {
    allowMixedContent: false,
    backgroundColor: "#0B0B0B",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      backgroundColor: "#0B0B0B",
      showSpinner: false,
    },
  },
};

export default config;

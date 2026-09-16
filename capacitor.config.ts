import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.drivon.passageiro",
  appName: "Drivon Passageiro",
  webDir: "dist",
  android: {
    allowMixedContent: false,
    backgroundColor: "#0B0B0B",
  },
  // Carrega o site publicado no GitHub Pages em vez de empacotar o build
  // dentro do APK — assim, atualizações no app só precisam de um novo
  // deploy pro gh-pages, sem gerar/reinstalar o APK de novo.
  server: {
    url: "https://natynhadejesus3-cmyk.github.io/drivon-passageiro/",
    cleartext: false,
    androidScheme: "https",
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

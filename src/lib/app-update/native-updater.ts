import { Capacitor, registerPlugin } from "@capacitor/core";
import type { NativeUpdater } from "./flow";

/**
 * Ponte com o plugin nativo ApkUpdater (android/app/src/sideload/.../ApkUpdaterPlugin.java).
 * Igual nos dois apps (no motorista: src/lib/updates/native-updater.ts).
 */
interface ApkUpdaterPlugin {
  status(): Promise<{ supported: boolean; canInstall: boolean }>;
  openInstallSettings(): Promise<void>;
  download(o: { url: string; sha256: string }): Promise<{ bytes: number }>;
  install(): Promise<void>;
  addListener(event: "progress", fn: (e: { percent: number }) => void): Promise<{ remove: () => Promise<void> }>;
}

const Plugin = registerPlugin<ApkUpdaterPlugin>("ApkUpdater");

/**
 * O APK carrega o site publicado, então a ponte nativa do Capacitor pode aparecer alguns instantes DEPOIS do
 * primeiro desenho da tela. Checar cedo demais trataria um APK novo como "navegador"/"APK antigo".
 */
export async function waitForNative(timeoutMs = 4000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (Capacitor.isNativePlatform()) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return Capacitor.isNativePlatform();
}

/** O atualizador nativo, ou null: APK ANTIGO (anterior à 1.3), que não tem o plugin. Só chame depois de waitForNative(). */
export function getNativeUpdater(): NativeUpdater | null {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("ApkUpdater")) return null;
  return {
    status: () => Plugin.status(),
    openInstallSettings: () => Plugin.openInstallSettings(),
    download: async (o, onProgress) => {
      const handle = await Plugin.addListener("progress", (e) => onProgress(e.percent));
      try {
        await Plugin.download(o);
      } finally {
        await handle.remove();
      }
    },
    install: () => Plugin.install(),
  };
}

/**
 * Abre um endereço FORA do app (no navegador do celular). Serve pro APK antigo baixar a versão nova: o WebView do
 * Capacitor entrega links de outro site ao navegador do Android, que baixa o arquivo.
 */
export function openExternalUrl(url: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

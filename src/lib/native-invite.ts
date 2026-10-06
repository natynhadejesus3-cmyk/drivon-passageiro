import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { parseInviteCode, savePendingInvite } from "@/lib/invite";

const LAUNCH_KEY = "drivon.passenger.launchInvite";
/** O Android pode reentregar o link que abriu o app (ex.: voltando pelos apps recentes). */
const LAUNCH_REPEAT_MS = 10 * 60 * 1000;

function launchAlreadyHandled(code: string): boolean {
  try {
    const raw = localStorage.getItem(LAUNCH_KEY);
    if (!raw) return false;
    const last = JSON.parse(raw) as { code?: string; at?: number };
    return last.code === code && Date.now() - (last.at ?? 0) < LAUNCH_REPEAT_MS;
  } catch {
    return false;
  }
}

function rememberLaunch(code: string) {
  try {
    localStorage.setItem(LAUNCH_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    /* ignora */
  }
}

/**
 * Dentro do app instalado: quando o Android entrega um link de convite (a pessoa tocou
 * "Abrir no app" na página de convite, ou o link https do QR), guarda o código e avisa
 * pra InviteAutoPair parear. Só funciona no APK novo (precisa do plugin @capacitor/app
 * e dos filtros de link no AndroidManifest); no APK antigo vira "não faz nada".
 * Devolve a função que desliga a escuta.
 */
export function listenForInviteLinks(onInvite: () => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  let cancelled = false;
  let remove: (() => Promise<void>) | undefined;

  const take = (url: string | undefined | null, fromLaunch: boolean) => {
    const code = parseInviteCode(url);
    if (!code) return;
    if (fromLaunch) {
      if (launchAlreadyHandled(code)) return;
      rememberLaunch(code);
    }
    savePendingInvite(code);
    onInvite();
  };

  try {
    App.getLaunchUrl()
      .then((r) => !cancelled && take(r?.url, true))
      .catch(() => {});
    App.addListener("appUrlOpen", (e) => take(e.url, false))
      .then((handle) => {
        if (cancelled) void handle.remove();
        else remove = () => handle.remove();
      })
      .catch(() => {});
  } catch {
    /* APK antigo, sem o plugin: segue sem deep link */
  }

  return () => {
    cancelled = true;
    void remove?.();
  };
}

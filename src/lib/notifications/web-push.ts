import { getDeviceId } from "./device";
import { savePushDevice } from "../repository";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function bufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

let registration: ServiceWorkerRegistration | null = null;

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  if (registration) return registration;
  try {
    // O app é publicado numa subpasta (GitHub Pages, ex.: /drivon-passageiro/),
    // não na raiz — registrar em "/sw.js" tentava buscar o arquivo na raiz do
    // domínio (github.io/sw.js), que não existe, e falhava sempre, silenciosamente.
    const base = import.meta.env.BASE_URL || "/";
    registration = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base, updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (e) {
    console.error("[drivon] registro do service worker falhou", e);
    return null;
  }
}

/**
 * Pede permissão de notificação (se ainda não decidida) e garante a
 * assinatura Web Push (VAPID) salva pro Drivon poder notificar esse
 * passageiro quando o motorista mandar mensagem com o app fechado. Idempotente
 * — pode ser chamada em toda abertura do app.
 */
export async function initWebPush(passengerId: string): Promise<void> {
  if (!pushSupported()) {
    console.warn("[drivon] Web Push não suportado neste navegador/WebView");
    return;
  }

  try {
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        console.warn("[drivon] permissão de notificação não concedida:", perm);
        return;
      }
    }

    const reg = await ensureServiceWorker();
    if (!reg) return;

    const key = import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined;
    if (!key) {
      console.error("[drivon] VITE_VAPID_PUBLIC_KEY ausente no build");
      return;
    }
    const appKey = urlBase64ToUint8Array(key);

    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      const current = bufferToBase64Url(sub.options?.applicationServerKey ?? null);
      if (current && current !== key) {
        await sub.unsubscribe().catch(() => undefined);
        sub = null;
      }
    }
    if (!sub) {
      sub = await reg.pushManager
        .subscribe({ userVisibleOnly: true, applicationServerKey: appKey as BufferSource })
        .catch((e) => {
          console.error("[drivon] pushManager.subscribe falhou", e);
          return null;
        });
    }
    if (!sub) return;

    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return;

    await savePushDevice(
      passengerId,
      getDeviceId(),
      { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
      navigator.userAgent.slice(0, 400),
    );
    console.log("[drivon] Web Push inscrito com sucesso");
  } catch (e) {
    console.error("[drivon] initWebPush falhou", e);
  }
}

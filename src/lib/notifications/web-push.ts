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

export type PermissionState = "unsupported" | "default" | "granted" | "denied";

export function notificationPermission(): PermissionState {
  if (!pushSupported()) return "unsupported";
  return Notification.permission as PermissionState;
}

let registration: ServiceWorkerRegistration | null = null;

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  if (registration) return registration;
  try {
    // O app é publicado numa subpasta (GitHub Pages, ex.: /drivon-passageiro/),
    // não na raiz — registrar em "/sw.js" buscava o arquivo na raiz do domínio
    // (github.io/sw.js), que não existe, e falhava sempre, silenciosamente.
    const base = import.meta.env.BASE_URL || "/";
    registration = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base, updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (e) {
    console.error("[drivon] registro do service worker falhou", e);
    return null;
  }
}

/** Garante a assinatura Web Push salva pro Drivon, assumindo que a permissão já foi concedida. */
async function subscribeAndSave(passengerId: string): Promise<boolean> {
  const reg = await ensureServiceWorker();
  if (!reg) return false;

  const key = import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined;
  if (!key) {
    console.error("[drivon] VITE_VAPID_PUBLIC_KEY ausente no build");
    return false;
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
  if (!sub) return false;

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false;

  await savePushDevice(
    passengerId,
    getDeviceId(),
    { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    navigator.userAgent.slice(0, 400),
  );
  console.log("[drivon] Web Push inscrito com sucesso");
  return true;
}

/**
 * Chamada em TODA abertura do app (sem pedir nada) — mesmo papel do
 * ensurePushSubscription() do app do motorista. Nunca chama
 * Notification.requestPermission() sozinha: navegadores/WebViews ignoram
 * silenciosamente esse pedido quando ele não vem de um toque direto da
 * pessoa (sem gesto do usuário), então chamar isso automaticamente no
 * carregamento do app nunca mostrava nada — parecia que "não tinha permissão
 * nenhuma pra pedir". Só reforça a inscrição quando já está concedida.
 */
export async function ensureWebPush(passengerId: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  try {
    await subscribeAndSave(passengerId);
  } catch (e) {
    console.error("[drivon] ensureWebPush falhou", e);
  }
}

/**
 * Pede a permissão de verdade — só deve ser chamada a partir de um toque
 * direto da pessoa (onClick de um botão), igual requestNotificationPermission()
 * no app do motorista (chamada só pelo toggle de Configurações, nunca sozinha).
 */
export async function requestWebPush(passengerId: string): Promise<PermissionState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "granted") {
    await subscribeAndSave(passengerId).catch(() => undefined);
    return "granted";
  }
  if (Notification.permission === "denied") return "denied";
  try {
    const perm = (await Notification.requestPermission()) as PermissionState;
    if (perm === "granted") await subscribeAndSave(passengerId).catch(() => undefined);
    return perm;
  } catch {
    return "denied";
  }
}

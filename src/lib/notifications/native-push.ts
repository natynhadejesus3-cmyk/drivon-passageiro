import { Capacitor } from "@capacitor/core";
import { getDeviceId } from "./device";
import { saveFcmToken } from "../repository";

const CHANNEL_ID = "drivon_passageiro_default";

/**
 * DESLIGADO DE PROPÓSITO: sem `android/app/google-services.json` real (do
 * app "com.drivon.passageiro" cadastrado no Firebase Console), o Firebase
 * não inicializa no Android e `PushNotifications.register()` derruba o app
 * inteiro — crash nativo, fora do alcance de qualquer try/catch em JS. O
 * app do motorista já caiu nessa exata armadilha (ver o mesmo comentário em
 * comfort-code-cave/src/lib/notifications/native-push.ts). Só vira `true`
 * depois que o google-services.json de verdade estiver em
 * android/app/google-services.json E um novo APK for gerado.
 */
const NATIVE_PUSH_ENABLED = true;

let started = false;

type NavigateFn = (url: string) => void;

export async function initNativePush(userId: string, navigate: NavigateFn): Promise<void> {
  if (!Capacitor.isNativePlatform() || started) return;
  started = true;
  if (!NATIVE_PUSH_ENABLED) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    await PushNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Mensagens",
      description: "Avisos de novas mensagens do motorista",
      importance: 5,
      visibility: 1,
      vibration: true,
    }).catch(() => undefined);

    await PushNotifications.addListener("registration", (t) => {
      void persistToken(userId, t.value);
    });
    await PushNotifications.addListener("registrationError", (e) => {
      console.error("[drivon] fcm register falhou", e);
    });
    await PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
      const url = (a.notification.data?.["url"] as string | undefined) ?? "/";
      navigate(url);
    });

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return;

    await PushNotifications.register();
  } catch (e) {
    console.error("[drivon] initNativePush falhou", e);
  }
}

async function persistToken(userId: string, token: string) {
  if (!token) return;
  try {
    await saveFcmToken(userId, getDeviceId(), token, `android-capacitor ${navigator.userAgent}`.slice(0, 400));
  } catch (e) {
    console.error("[drivon] falha ao salvar token FCM", e);
  }
}

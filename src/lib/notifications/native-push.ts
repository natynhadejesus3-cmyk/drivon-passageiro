import { Capacitor } from "@capacitor/core";
import { getDeviceId } from "./device";
import { saveFcmToken } from "../repository";

const CHANNEL_ID = "drivon_passageiro_default";

const NATIVE_PUSH_ENABLED = true;

let started = false;

// Diagnóstico visível na tela (Perfil) — sem isso, um erro nessa cadeia
// (registro, permissão, salvar token) não deixa rastro nenhum pra quem não
// tem acesso a um console de desenvolvedor no celular.
let status = "ainda não iniciado";
export function getNativePushStatus(): string {
  return status;
}
function setStatus(s: string) {
  status = s;
  console.log("[drivon] native push:", s);
}

type NavigateFn = (url: string) => void;

export async function initNativePush(userId: string, navigate: NavigateFn): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    setStatus("não é o app nativo (navegador comum)");
    return;
  }
  if (started) return;
  started = true;
  if (!NATIVE_PUSH_ENABLED) {
    setStatus("desligado (NATIVE_PUSH_ENABLED = false)");
    return;
  }

  try {
    setStatus("carregando plugin...");
    const { PushNotifications } = await import("@capacitor/push-notifications");

    await PushNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Mensagens",
      description: "Avisos de novas mensagens do motorista",
      importance: 5,
      visibility: 1,
      vibration: true,
    }).catch((e) => setStatus(`createChannel falhou: ${e}`));

    await PushNotifications.addListener("registration", (t) => {
      setStatus(`token recebido, salvando...`);
      void persistToken(userId, t.value);
    });
    await PushNotifications.addListener("registrationError", (e) => {
      setStatus(`registrationError: ${JSON.stringify(e)}`);
    });
    await PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
      const url = (a.notification.data?.["url"] as string | undefined) ?? "/";
      navigate(url);
    });

    setStatus("checando permissão...");
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      setStatus("pedindo permissão...");
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      setStatus(`permissão negada (${perm.receive})`);
      return;
    }

    setStatus("permissão ok, registrando no FCM...");
    await PushNotifications.register();
    setStatus("register() chamado, aguardando token...");
  } catch (e) {
    setStatus(`erro: ${e}`);
  }
}

async function persistToken(userId: string, token: string) {
  if (!token) return;
  try {
    await saveFcmToken(userId, getDeviceId(), token, `android-capacitor ${navigator.userAgent}`.slice(0, 400));
    setStatus(`token salvo com sucesso (${token.slice(0, 12)}...)`);
  } catch (e) {
    setStatus(`falha ao salvar token: ${e}`);
  }
}

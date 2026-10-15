import { Capacitor } from "@capacitor/core";
import { getDeviceId } from "./device";
import { saveFcmToken } from "../repository";

const CHANNEL_ID = "drivon_passageiro_default";

// Canal com o som próprio das MENSAGENS do motorista (arquivo em res/raw, dentro do APK). O app marca o
// build junto do token (drivon-build/N) e o servidor escolhe o canal pelo build de cada aparelho. Um canal
// não muda de som depois de criado: build 2 = canal v1 (som `mensagem_nova`); build 3 = canal v2 (som
// `mensagem_v2`, o áudio do vídeo do dono) e o v1 é apagado. Mesma regra de message-channel.ts do app do motorista.
const MESSAGE_CHANNEL_V1 = { channelId: "drivon_passageiro_messages_v1", sound: "mensagem_nova" };
const MESSAGE_CHANNEL_V2 = { channelId: "drivon_passageiro_messages_v2", sound: "mensagem_v2" };
function messageChannelForBuild(build: number): { channelId: string; sound: string } | null {
  if (build >= 3) return MESSAGE_CHANNEL_V2;
  if (build >= 2) return MESSAGE_CHANNEL_V1;
  return null;
}
let appBuild = 0;

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
      // Só o nome muda (o Android deixa renomear um canal existente): "Mensagens" agora é o canal com o som próprio.
      name: "Avisos da corrida",
      description: "Corrida aceita e outros avisos do motorista",
      importance: 5,
      visibility: 1,
      vibration: true,
    }).catch((e) => setStatus(`createChannel falhou: ${e}`));

    const { App } = await import("@capacitor/app");
    const info = await App.getInfo().catch(() => null);
    appBuild = Number(info?.build) || 0;
    const messageChannel = messageChannelForBuild(appBuild);
    if (messageChannel) {
      await PushNotifications.createChannel({
        id: messageChannel.channelId,
        name: "Mensagens",
        description: "Avisos de novas mensagens do motorista",
        importance: 5,
        visibility: 1,
        sound: messageChannel.sound,
        vibration: true,
      }).catch((e) => setStatus(`createChannel (mensagens) falhou: ${e}`));
      // O som mudou (canal v2): tira o canal antigo da lista do Android pra não ficar "Mensagens" em dobro.
      if (messageChannel.channelId !== MESSAGE_CHANNEL_V1.channelId) {
        await PushNotifications.deleteChannel({ id: MESSAGE_CHANNEL_V1.channelId }).catch(() => undefined);
      }
    }

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
    // a marca drivon-build/N fica no COMEÇO (o texto é cortado em 400 caracteres)
    const ua = `android-capacitor${appBuild ? ` drivon-build/${appBuild}` : ""} ${navigator.userAgent}`.slice(0, 400);
    await saveFcmToken(userId, getDeviceId(), token, ua);
    setStatus(`token salvo com sucesso (${token.slice(0, 12)}...)`);
  } catch (e) {
    setStatus(`falha ao salvar token: ${e}`);
  }
}

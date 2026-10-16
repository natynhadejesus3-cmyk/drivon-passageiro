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
// Build 5 (APK 1.4): som `aviso_novo` nas mensagens (canal v3) e nos lembretes de 40/20/10/5 min (canal próprio).
// O aviso "na hora" fica no canal de sempre. Os canais v1/v2 são apagados.
const MESSAGE_CHANNEL_V3 = { channelId: "drivon_passageiro_messages_v3", sound: "aviso_novo" };
const REMINDER_CHANNEL = { channelId: "drivon_passageiro_reminders_v1", sound: "aviso_novo" };
const NOTICE_SOUND_V3_BUILD = 5;
function messageChannelForBuild(build: number): { channelId: string; sound: string } | null {
  if (build >= NOTICE_SOUND_V3_BUILD) return MESSAGE_CHANNEL_V3;
  if (build >= 3) return MESSAGE_CHANNEL_V2;
  if (build >= 2) return MESSAGE_CHANNEL_V1;
  return null;
}
let appBuild = 0;

const NATIVE_PUSH_ENABLED = true;

let started = false;
let currentUserId = "";
let lastToken = "";

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
  if (started) {
    // Trocou de conta sem fechar o app: o aparelho continuava cadastrado na conta ANTERIOR, e os avisos da
    // conta nova (corrida aceita, lembretes) não chegavam. Cadastra o mesmo aparelho na conta nova.
    if (userId !== currentUserId) {
      currentUserId = userId;
      if (lastToken) {
        void persistToken(userId, lastToken);
      } else {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        await PushNotifications.register().catch(() => undefined);
      }
    }
    return;
  }
  started = true;
  currentUserId = userId;
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
      // O som mudou (canal novo): tira os canais antigos da lista do Android pra não ficar "Mensagens" em dobro.
      for (const old of [MESSAGE_CHANNEL_V1.channelId, MESSAGE_CHANNEL_V2.channelId]) {
        if (messageChannel.channelId !== old) await PushNotifications.deleteChannel({ id: old }).catch(() => undefined);
      }
    }
    if (appBuild >= NOTICE_SOUND_V3_BUILD) {
      await PushNotifications.createChannel({
        id: REMINDER_CHANNEL.channelId,
        name: "Lembretes (40 a 5 min antes)",
        description: "Avisos antes da corrida: 40, 20, 10 e 5 minutos",
        importance: 5,
        visibility: 1,
        sound: REMINDER_CHANNEL.sound,
        vibration: true,
      }).catch((e) => setStatus(`createChannel (lembretes) falhou: ${e}`));
    }

    await PushNotifications.addListener("registration", (t) => {
      setStatus(`token recebido, salvando...`);
      lastToken = t.value;
      void persistToken(currentUserId, t.value);
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

/** A coluna device_id do banco é do tipo uuid: gera um uuid fixo para o par (aparelho, conta). */
async function deviceIdForAccount(deviceId: string, userId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${deviceId}|${userId}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)).slice(0, 16);
  hash[6] = (hash[6]! & 0x0f) | 0x50; // versão 5
  hash[8] = (hash[8]! & 0x3f) | 0x80; // variante RFC 4122
  const h = Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function persistToken(userId: string, token: string) {
  if (!token) return;
  try {
    // a marca drivon-build/N fica no COMEÇO (o texto é cortado em 400 caracteres)
    const ua = `android-capacitor${appBuild ? ` drivon-build/${appBuild}` : ""} ${navigator.userAgent}`.slice(0, 400);
    // O identificador leva a conta junto: o banco só deixa cada conta mexer nos próprios cadastros, então
    // quando o mesmo aparelho já tinha sido usado por OUTRA conta, salvar com o identificador puro era
    // barrado e a conta nova ficava sem receber nenhum aviso (corrida aceita, lembretes).
    await saveFcmToken(userId, await deviceIdForAccount(getDeviceId(), userId), token, ua);
    setStatus(`token salvo com sucesso (${token.slice(0, 12)}...)`);
  } catch (e) {
    // O erro do banco é um objeto (não um Error): "${e}" mostrava só [object Object].
    const err = e as { message?: string; code?: string; details?: string; hint?: string };
    setStatus(
      `falha ao salvar token: ${[err?.code, err?.message, err?.details, err?.hint].filter(Boolean).join(" | ") || String(e)}`,
    );
  }
}

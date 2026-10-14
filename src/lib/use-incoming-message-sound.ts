import { useEffect, useRef } from "react";
import { detectIncoming, type ChatRole } from "./chat-unread";
import { playMessageSound, preloadMessageSound } from "./message-sound";

/**
 * Toca o som quando chega mensagem nova do OUTRO lado com a conversa aberta e o app à vista.
 *
 * `ready`: só vira true depois da primeira busca desta visita à conversa (abrir a conversa não deve
 * tocar nada por causa de mensagens antigas). `resetKey` (o id da conversa) zera a memória quando a
 * pessoa troca de conversa.
 */
export function useIncomingMessageSound(
  messages: { id: string; sender_role: string }[],
  myRole: ChatRole,
  ready: boolean,
  resetKey: string,
) {
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    seen.current = null;
    preloadMessageSound();
  }, [resetKey]);

  useEffect(() => {
    if (!ready) return;
    const visible = typeof document === "undefined" || document.visibilityState === "visible";
    const r = detectIncoming(seen.current, messages, myRole, visible);
    seen.current = r.seen;
    if (r.play) playMessageSound();
  }, [messages, ready, myRole]);
}

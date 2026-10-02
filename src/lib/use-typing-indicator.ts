import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "driver" | "passenger";

// Reenvia o "digitando" no máximo a cada 2s (não a cada tecla).
const SEND_EVERY_MS = 2_000;
// Parou de digitar por 3s: avisa o outro lado que parou.
const STOP_AFTER_MS = 3_000;
// Sem sinal novo por 5s o indicador some sozinho -- cobre o outro lado ter
// fechado o app / perdido a internet no meio da digitação.
const HIDE_AFTER_MS = 5_000;

/**
 * "Fulano está digitando…" em tempo real, igual aos apps de mensagem. Usa o
 * Broadcast do Supabase Realtime num canal por conversa (typing:<linkId>):
 * o sinal passa direto de um aparelho pro outro, sem gravar nada no banco.
 * O app do passageiro tem o mesmo hook, no mesmo canal.
 */
export function useTypingIndicator(linkId: string | undefined, myRole: Role) {
  const [otherTyping, setOtherTyping] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const joinedRef = useRef(false);
  const lastSentRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!linkId) return;
    const channel = supabase.channel(`typing:${linkId}`, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload || payload.role === myRole) return;
        clearTimeout(hideTimerRef.current);
        if (payload.typing) {
          setOtherTyping(true);
          hideTimerRef.current = setTimeout(() => setOtherTyping(false), HIDE_AFTER_MS);
        } else {
          setOtherTyping(false);
        }
      })
      .subscribe((status) => {
        joinedRef.current = status === "SUBSCRIBED";
      });
    channelRef.current = channel;

    return () => {
      clearTimeout(stopTimerRef.current);
      clearTimeout(hideTimerRef.current);
      // Saiu da conversa no meio da digitação: avisa que parou.
      if (lastSentRef.current && joinedRef.current) {
        void channel.send({ type: "broadcast", event: "typing", payload: { role: myRole, typing: false } });
      }
      lastSentRef.current = 0;
      joinedRef.current = false;
      channelRef.current = null;
      setOtherTyping(false);
      void supabase.removeChannel(channel);
    };
  }, [linkId, myRole]);

  const send = useCallback(
    (typing: boolean) => {
      const channel = channelRef.current;
      if (!channel || !joinedRef.current) return;
      void channel.send({ type: "broadcast", event: "typing", payload: { role: myRole, typing } });
    },
    [myRole],
  );

  /** Parou de digitar (enviou, apagou tudo, saiu do campo). */
  const stopTyping = useCallback(() => {
    clearTimeout(stopTimerRef.current);
    if (lastSentRef.current) send(false);
    lastSentRef.current = 0;
  }, [send]);

  /** Chamar a cada alteração do campo de mensagem. */
  const notifyTyping = useCallback(
    (hasText: boolean) => {
      if (!hasText) {
        stopTyping();
        return;
      }
      const now = Date.now();
      if (now - lastSentRef.current > SEND_EVERY_MS) {
        send(true);
        lastSentRef.current = now;
      }
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = setTimeout(stopTyping, STOP_AFTER_MS);
    },
    [send, stopTyping],
  );

  /** A mensagem do outro lado chegou: o indicador some na hora. */
  const clearOtherTyping = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    setOtherTyping(false);
  }, []);

  return { otherTyping, notifyTyping, stopTyping, clearOtherTyping };
}

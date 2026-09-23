import { useEffect } from "react";
import { useAuth } from "./auth-context";
import { seedPassengerNameIfMissing, setPassengerPresence } from "./repository";

/**
 * Status "online" real (visível pro motorista), igual o WhatsApp: fica
 * online enquanto o app está aberto, marca offline e grava "visto por
 * último" ao sair/minimizar. Roda uma vez, no topo do app, pra toda a
 * sessão do passageiro.
 */
export function usePresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    void setPassengerPresence(userId, true).catch(() => {});
    // Sem isso, o motorista só vê o nome do passageiro depois que ele abrir
    // a tela de perfil manualmente — o nome do cadastro nunca chegava lá.
    void seedPassengerNameIfMissing(userId, user.user_metadata?.display_name as string | undefined).catch(() => {});

    function onHidden() {
      if (document.visibilityState === "hidden") void setPassengerPresence(userId, false).catch(() => {});
    }
    function onVisible() {
      if (document.visibilityState === "visible") void setPassengerPresence(userId, true).catch(() => {});
    }
    document.addEventListener("visibilitychange", onHidden);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onHidden);

    // Fechar o app "no tapa" nunca dispara visibilitychange/pagehide — o
    // is_online ficava travado em true pra sempre, e isso também travava o
    // push do motorista pra sempre (o gatilho achava que o app sempre estava
    // aberto). Esse heartbeat mantém last_seen_at fresco enquanto o app está
    // de verdade em primeiro plano; passenger_public_profile e o gatilho de
    // push só confiam no is_online quando last_seen_at é recente.
    const heartbeat = setInterval(() => {
      if (document.visibilityState === "visible") void setPassengerPresence(userId, true).catch(() => {});
    }, 45_000);

    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onHidden);
      clearInterval(heartbeat);
    };
  }, [user?.id]);
}

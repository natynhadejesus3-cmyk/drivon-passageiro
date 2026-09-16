import { useEffect } from "react";
import { useAuth } from "./auth-context";
import { setPassengerPresence } from "./repository";

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

    function onHidden() {
      if (document.visibilityState === "hidden") void setPassengerPresence(userId, false).catch(() => {});
    }
    function onVisible() {
      if (document.visibilityState === "visible") void setPassengerPresence(userId, true).catch(() => {});
    }
    document.addEventListener("visibilitychange", onHidden);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onHidden);
    };
  }, [user?.id]);
}

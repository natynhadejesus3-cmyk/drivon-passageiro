import { useCallback, useEffect, useState } from "react";
import type { ChatMessage, DriverPassengerLink, DriverPublicProfile } from "@/integrations/supabase/types";
import { getDriverPublicProfile, getLink, getLinks, getMessages, getRideRequests, getUnreadByLink, subscribeToChat, subscribeToInbox } from "./repository";

function useRefetchOnFocus(refetch: () => void) {
  useEffect(() => {
    const onFocus = () => document.visibilityState === "visible" && refetch();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [refetch]);
}

export function useLinks() {
  const [links, setLinks] = useState<DriverPassengerLink[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    getLinks()
      .then(setLinks)
      .catch((e) => console.error("[drivon] getLinks failed", e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refetch, [refetch]);
  useRefetchOnFocus(refetch);

  return { links, loading, refetch };
}

export function useLink(linkId: string | undefined) {
  const [link, setLink] = useState<DriverPassengerLink | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!linkId) return;
    setLoading(true);
    getLink(linkId)
      .then(setLink)
      .catch((e) => console.error("[drivon] getLink failed", e))
      .finally(() => setLoading(false));
  }, [linkId]);

  return { link, loading };
}

export function useMessages(linkId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!linkId) return;
    getMessages(linkId)
      .then(setMessages)
      .catch((e) => console.error("[drivon] getMessages failed", e))
      .finally(() => setLoading(false));
  }, [linkId]);

  useEffect(refetch, [refetch]);

  useEffect(() => {
    if (!linkId) return;
    const channel = subscribeToChat(linkId, refetch, refetch);
    return () => {
      channel.unsubscribe();
    };
  }, [linkId, refetch]);

  // Voltou pro app (tocou numa notificação, trocou de app): busca de novo. O
  // tempo real cai quando o Android suspende o app e não reenvia o que passou
  // nesse meio-tempo -- sem isso a mensagem nova só aparecia depois de sair da
  // conversa e entrar de novo.
  useRefetchOnFocus(refetch);

  // Rede de segurança com a conversa aberta, caso o tempo real falhe.
  useEffect(() => {
    if (!linkId) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refetch();
    }, 6_000);
    return () => clearInterval(id);
  }, [linkId, refetch]);

  return { messages, loading, refetch };
}

/**
 * Nome/foto/status real do motorista. A view não pode entrar no Realtime do
 * Postgres (só tabelas base podem), então atualiza por polling — suficiente
 * pra "online agora" não ficar visivelmente desatualizado numa conversa aberta.
 */
export function useDriverProfile(driverId: string | undefined, pollMs = 8_000) {
  const [profile, setProfile] = useState<DriverPublicProfile | null>(null);

  const refetch = useCallback(() => {
    if (!driverId) return;
    getDriverPublicProfile(driverId)
      .then(setProfile)
      .catch((e) => console.error("[drivon] getDriverPublicProfile failed", e));
  }, [driverId]);

  useEffect(refetch, [refetch]);

  useEffect(() => {
    if (!driverId) return;
    const id = setInterval(refetch, pollMs);
    return () => clearInterval(id);
  }, [driverId, pollMs, refetch]);

  useRefetchOnFocus(refetch);

  return { profile, refetch };
}

/** Pedidos de corrida da pessoa (qualquer situação); a Agenda separa o que é agenda e o que é histórico. */
export function useRideRequests() {
  const [rides, setRides] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    getRideRequests()
      .then(setRides)
      .catch((e) => console.error("[drivon] getRideRequests failed", e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refetch, [refetch]);
  useRefetchOnFocus(refetch);

  return { rides, loading, refetch };
}

/**
 * Mensagens não lidas por conversa (linkId -> quantidade), pra lista de motoristas mostrar
 * "Mensagem não lida". Atualiza na hora pelo tempo real, ao voltar pro app e, por garantia, a cada 15 s.
 */
export function useUnreadByLink() {
  const [unread, setUnread] = useState<Record<string, number>>({});

  const refetch = useCallback(() => {
    getUnreadByLink()
      .then(setUnread)
      .catch((e) => console.error("[drivon] getUnreadByLink failed", e));
  }, []);

  useEffect(refetch, [refetch]);

  useEffect(() => {
    const channel = subscribeToInbox(refetch, refetch);
    return () => {
      void channel.unsubscribe();
    };
  }, [refetch]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refetch();
    }, 15_000);
    return () => clearInterval(id);
  }, [refetch]);

  useRefetchOnFocus(refetch);

  return unread;
}
import { useCallback, useEffect, useState } from "react";
import type { ChatMessage, DriverPassengerLink, DriverPublicProfile } from "@/integrations/supabase/types";
import { getConfirmedRides, getDriverPublicProfile, getLink, getLinks, getMessages, subscribeToChat } from "./repository";

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
    const channel = subscribeToChat(linkId, refetch);
    return () => {
      channel.unsubscribe();
    };
  }, [linkId, refetch]);

  return { messages, loading, refetch };
}

/**
 * Nome/foto/status real do motorista. A view não pode entrar no Realtime do
 * Postgres (só tabelas base podem), então atualiza por polling — suficiente
 * pra "online agora" não ficar visivelmente desatualizado numa conversa aberta.
 */
export function useDriverProfile(driverId: string | undefined, pollMs = 20_000) {
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

export function useConfirmedRides() {
  const [rides, setRides] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    getConfirmedRides()
      .then(setRides)
      .catch((e) => console.error("[drivon] getConfirmedRides failed", e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refetch, [refetch]);
  useRefetchOnFocus(refetch);

  return { rides, loading, refetch };
}

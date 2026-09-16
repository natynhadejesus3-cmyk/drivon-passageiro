import { useCallback, useEffect, useState } from "react";
import type { ChatMessage, DriverPassengerLink } from "@/integrations/supabase/types";
import { getConfirmedRides, getLink, getLinks, getMessages, subscribeToChat } from "./repository";

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

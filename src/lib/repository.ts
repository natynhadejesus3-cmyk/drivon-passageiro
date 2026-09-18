import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type {
  ChatMessage,
  DriverPassengerLink,
  DriverPublicProfile,
  PairWithDriverResult,
  PassengerProfile,
} from "@/integrations/supabase/types";

/**
 * driver_passenger_links has no driver display-name column (see integration
 * contract) — pair_with_driver only returns it once, at pairing time. We
 * cache it locally so the roster can render a name on later app opens
 * without ever touching the driver-owned `profiles` table.
 */
const NAME_CACHE_KEY = "drivon.passenger.driverNames";

function getNameCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NAME_CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function cacheDriverName(driverId: string, name: string) {
  const cache = getNameCache();
  cache[driverId] = name;
  localStorage.setItem(NAME_CACHE_KEY, JSON.stringify(cache));
}

export function getCachedDriverName(driverId: string): string {
  return getNameCache()[driverId] ?? "Motorista";
}

const CODE_PREFIX = "DRIVON-PAIR:";

/** Extracts the 10-char pairing code from a scanned/pasted QR payload. */
export function extractPairCode(raw: string): string | null {
  const trimmed = raw.trim();
  const value = trimmed.includes(CODE_PREFIX) ? trimmed.split(CODE_PREFIX)[1] : trimmed;
  const code = value?.trim().toUpperCase();
  return code && /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(code) ? code : null;
}

export async function pairWithDriver(code: string, displayName?: string): Promise<PairWithDriverResult> {
  const { data, error } = await supabase.rpc("pair_with_driver", {
    p_code: code,
    p_passenger_display_name: displayName || null,
  });
  if (error) throw error;
  // pair_with_driver is `RETURNS TABLE(...)`, so PostgREST always hands back
  // an array of rows (one, here) — never a bare object.
  const result = (data as PairWithDriverResult[])?.[0];
  if (!result) throw new Error("Código de pareamento inválido.");
  cacheDriverName(result.driver_id, result.driver_name);
  return result;
}

export async function getLinks(): Promise<DriverPassengerLink[]> {
  const { data, error } = await supabase
    .from("driver_passenger_links")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getLink(linkId: string): Promise<DriverPassengerLink | null> {
  const { data, error } = await supabase
    .from("driver_passenger_links")
    .select("*")
    .eq("id", linkId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function unlinkDriver(linkId: string): Promise<void> {
  const { error } = await supabase.from("driver_passenger_links").delete().eq("id", linkId);
  if (error) throw error;
}

export async function getMessages(linkId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("link_id", linkId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(
  linkId: string,
  passengerId: string,
  body: string,
  isRideRequest = false,
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      link_id: linkId,
      sender_role: "passenger",
      sender_id: passengerId,
      body,
      is_ride_request: isRideRequest,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markRead(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) throw error;
}

/** Ride requests the driver has confirmed — across every paired driver. */
export async function getConfirmedRides(): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("is_ride_request", true)
    .eq("ride_confirmed", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Nome/foto/status real do motorista — só devolve algo se o pareamento existir de verdade (checado dentro da view). */
export async function getDriverPublicProfile(driverId: string): Promise<DriverPublicProfile | null> {
  const { data, error } = await supabase
    .from("driver_public_profile")
    .select("full_name, avatar_url, is_online, last_seen_at, driver_id")
    .eq("driver_id", driverId)
    .maybeSingle();
  if (error) throw error;
  if (data?.full_name) cacheDriverName(driverId, data.full_name);
  return data;
}

export async function getMyPassengerProfile(userId: string): Promise<PassengerProfile | null> {
  const { data, error } = await supabase.from("passenger_profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertPassengerProfile(
  userId: string,
  patch: Partial<Pick<PassengerProfile, "full_name" | "avatar_url">>,
): Promise<void> {
  const { error } = await supabase
    .from("passenger_profiles")
    .upsert({ id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw error;
}

export async function saveFcmToken(
  userId: string,
  deviceId: string,
  token: string,
  userAgent?: string,
): Promise<void> {
  // o mesmo token não pode pertencer a dois aparelhos
  await supabase.from("passenger_push_tokens").delete().eq("token", token).neq("device_id", deviceId);
  const { error } = await supabase.from("passenger_push_tokens").upsert(
    {
      passenger_id: userId,
      device_id: deviceId,
      token,
      user_agent: userAgent ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "device_id" },
  );
  if (error) throw error;
}

/**
 * Garante que o motorista sempre tenha ALGUM nome pra ver, mesmo que o
 * passageiro nunca abra a tela de perfil manualmente — usa o nome que ele já
 * deu no cadastro. Só roda quando ainda não existe full_name salvo (não
 * sobrescreve uma edição manual).
 */
export async function seedPassengerNameIfMissing(userId: string, displayName?: string): Promise<void> {
  if (!displayName?.trim()) return;
  const existing = await getMyPassengerProfile(userId);
  if (existing?.full_name) return;
  await upsertPassengerProfile(userId, { full_name: displayName.trim() });
}

export async function setPassengerPresence(userId: string, online: boolean): Promise<void> {
  const { error } = await supabase
    .from("passenger_profiles")
    .upsert({ id: userId, is_online: online, last_seen_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw error;
}

export function subscribeToChat(linkId: string, onChange: () => void): RealtimeChannel {
  return supabase
    .channel(`chat:${linkId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chat_messages", filter: `link_id=eq.${linkId}` },
      onChange,
    )
    .subscribe();
}

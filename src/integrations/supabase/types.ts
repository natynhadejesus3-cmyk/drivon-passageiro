/**
 * Hand-written slice of the shared Drivon Supabase schema — only the tables
 * and RPC this app is allowed to touch (see the integration contract). Not
 * auto-generated (no `supabase gen types` access from this repo, since it
 * only holds the publishable key), but cross-checked field-for-field against
 * the driver app's own migrations (comfort-code-cave/supabase/migrations/
 * 20260915120000_*.sql, 20260915120100_*.sql and 20260916090000_*.sql) and
 * its generated src/integrations/supabase/types.ts.
 */

export type SenderRole = "passenger" | "driver";

export type DriverPassengerLink = {
  id: string;
  driver_id: string;
  passenger_id: string;
  passenger_display_name: string;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  link_id: string;
  sender_role: SenderRole;
  sender_id: string;
  body: string;
  is_ride_request: boolean;
  ride_confirmed: boolean;
  ride_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type PairWithDriverResult = {
  link_id: string;
  driver_id: string;
  driver_name: string;
  already_paired: boolean;
};

/** Só os campos públicos do motorista — vem da view driver_public_profile. */
export type DriverPublicProfile = {
  driver_id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_online: boolean;
  last_seen_at: string | null;
};

/** Linha própria do passageiro — só ele mesmo lê/escreve (RLS auth.uid() = id). */
export type PassengerProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_online: boolean;
  last_seen_at: string | null;
  updated_at: string;
};

/** Token FCM do aparelho — o backend (Edge Function) lê via service_role. */
export type PassengerPushToken = {
  id: string;
  passenger_id: string;
  device_id: string;
  token: string;
  user_agent: string | null;
  updated_at: string;
};

/** Assinatura Web Push (VAPID) do aparelho — o Drivon (motorista) lê via service_role pra notificar. */
export type PassengerPushDevice = {
  device_id: string;
  passenger_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      driver_passenger_links: {
        Row: DriverPassengerLink;
        Insert: Partial<DriverPassengerLink>;
        Update: Partial<DriverPassengerLink>;
        Relationships: [];
      };
      chat_messages: {
        Row: ChatMessage;
        Insert: Omit<ChatMessage, "id" | "created_at" | "ride_confirmed" | "ride_id" | "read_at"> &
          Partial<Pick<ChatMessage, "ride_confirmed" | "ride_id" | "read_at">>;
        Update: Partial<Pick<ChatMessage, "read_at">>;
        Relationships: [];
      };
      passenger_profiles: {
        Row: PassengerProfile;
        Insert: Partial<PassengerProfile> & Pick<PassengerProfile, "id">;
        Update: Partial<PassengerProfile>;
        Relationships: [];
      };
      passenger_push_tokens: {
        Row: PassengerPushToken;
        Insert: Partial<PassengerPushToken> & Pick<PassengerPushToken, "passenger_id" | "device_id" | "token">;
        Update: Partial<PassengerPushToken>;
        Relationships: [];
      };
      passenger_push_devices: {
        Row: PassengerPushDevice;
        Insert: Partial<PassengerPushDevice> &
          Pick<PassengerPushDevice, "device_id" | "passenger_id" | "endpoint" | "p256dh" | "auth">;
        Update: Partial<PassengerPushDevice>;
        Relationships: [];
      };
    };
    Views: {
      driver_public_profile: {
        Row: DriverPublicProfile;
        Relationships: [];
      };
    };
    Functions: {
      pair_with_driver: {
        // RETURNS TABLE(...) in Postgres → PostgREST always returns an array of rows.
        Args: { p_code: string; p_passenger_display_name?: string | null };
        Returns: PairWithDriverResult[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

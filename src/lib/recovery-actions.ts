import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Troca o código de números do e-mail de "esqueci minha senha" por uma sessão de recuperação.
 * Lança o erro do Supabase (passe por errorMessage() pra mostrar em português).
 */
export async function verifyRecoveryCode(email: string, code: string): Promise<Session> {
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "recovery" });
  if (error) throw error;
  if (!data.session) throw new Error("Auth session missing!");
  return data.session;
}

import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Troca o link/código do e-mail de "esqueci minha senha" por uma sessão de recuperação.
 * Lançam o erro do Supabase (passe por errorMessage() pra mostrar em português).
 */

// Cada token só vale uma vez: se o React (ou o Android, reentregando o link) chamar de novo,
// devolve a mesma resposta em vez de gastar o token duas vezes e mostrar um falso "expirou".
const inFlight = new Map<string, Promise<Session>>();

export function verifyRecoveryToken(tokenHash: string): Promise<Session> {
  let attempt = inFlight.get(tokenHash);
  if (!attempt) {
    attempt = (async () => {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
      if (error) throw error;
      if (!data.session) throw new Error("Auth session missing!");
      return data.session;
    })();
    inFlight.set(tokenHash, attempt);
  }
  return attempt;
}

export async function verifyRecoveryCode(email: string, code: string): Promise<Session> {
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "recovery" });
  if (error) throw error;
  if (!data.session) throw new Error("Auth session missing!");
  return data.session;
}

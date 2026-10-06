import { supabase } from "@/integrations/supabase/client";
import { loginWithIdentifier as loginCore } from "@/lib/login-core";

/**
 * Rota de login no servidor do app do motorista (aceita o @usuário ou o e-mail; mesma conta
 * dos dois apps; mesmo bloqueio de tentativas). Fica no Worker do motorista porque só o
 * servidor pode achar o e-mail por trás de um @usuário sem expor o e-mail ao navegador.
 */
const LOGIN_URL = "https://natynhadejesus3-cmyk-comfort-code-cave.canalgringo028.workers.dev/api/public/passenger-login";
const TIMEOUT_MS = 15_000;

/** Entra com @usuário ou e-mail + senha. Lança Error com mensagem pra mostrar (use errorMessage()). */
export function loginWithIdentifier(identifier: string, password: string): Promise<void> {
  return loginCore(identifier, password, {
    postLogin: async (id, pw) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        // text/plain de propósito: é um pedido "simples" do navegador, sem pré-voo OPTIONS.
        const r = await fetch(LOGIN_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ identifier: id, password: pw }),
          signal: ctrl.signal,
        });
        const body = await r.json().catch(() => null);
        return { status: r.status, body };
      } finally {
        clearTimeout(timer);
      }
    },
    setSession: async (tokens) => {
      const { error } = await supabase.auth.setSession(tokens);
      return error ? error.message : null;
    },
    signInWithEmail: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    },
  });
}

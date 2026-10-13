import { supabase } from "@/integrations/supabase/client";

/**
 * Marcar "offline" ao minimizar/fechar o app, de um jeito que SOBREVIVE a o Android congelar o app.
 *
 * O supabase-js manda o pedido normal, e logo ao minimizar o Android pode congelar o app antes de
 * ele terminar: o banco ficava com is_online=true (travado) e o servidor achava que o passageiro
 * ainda estava vendo a tela -- por isso o aviso (push) não chegava. Aqui o pedido vai com
 * `keepalive`, que o navegador termina mesmo depois de a página sair de cena.
 */

let accessToken: string | null = null;

/** Mantém o token da sessão à mão (na hora de minimizar não dá tempo de ir buscar). Devolve a função que desliga. */
export function trackAccessToken(): () => void {
  void supabase.auth.getSession().then(({ data }) => {
    accessToken = data.session?.access_token ?? null;
  });
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    accessToken = session?.access_token ?? null;
  });
  return () => sub.subscription.unsubscribe();
}

/** Grava is_online=false pro perfil do passageiro, com keepalive. Nunca lança. */
export function sendOfflineBeacon(userId: string): void {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (!url || !key || !accessToken) return;
    void fetch(`${url}/rest/v1/passenger_profiles?on_conflict=id`, {
      method: "POST",
      keepalive: true,
      headers: {
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ id: userId, is_online: false, last_seen_at: new Date().toISOString() }),
    }).catch(() => {});
  } catch {
    /* sem rede ou sem fetch: o heartbeat parado já faz o servidor perceber em ~50 s */
  }
}

import { supabase } from "@/integrations/supabase/client";

/**
 * Cancelar um pedido/corrida. O cancelamento de verdade acontece no servidor do Drivon (ele cancela a
 * corrida do motorista e manda o aviso pra ele): o passageiro não consegue mexer nisso direto no banco.
 */
const CANCEL_URL = "https://natynhadejesus3-cmyk-comfort-code-cave.canalgringo028.workers.dev/api/public/cancel-ride";
const TIMEOUT_MS = 20_000;

export type CancelOutcome = { ok: true } | { ok: false; error: string };

export async function requestRideCancellation(messageId: string): Promise<CancelOutcome> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "Sua sessão acabou. Entre de novo e tente outra vez." };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // text/plain evita o pré-voo OPTIONS; o servidor lê o corpo como texto.
    const res = await fetch(CANCEL_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageId }),
      signal: ctrl.signal,
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (res.ok && body?.ok) return { ok: true };
    return { ok: false, error: body?.error ?? "Não foi possível cancelar agora. Tente de novo em instantes." };
  } catch {
    return { ok: false, error: "Sem conexão com a internet. Confira e tente de novo." };
  } finally {
    clearTimeout(timer);
  }
}

import { supabase } from "@/integrations/supabase/client";

/**
 * "Instalou o app e o motorista já está lá".
 *
 * O app instalado por fora da Play Store não recebe o convite que a pessoa viu no
 * navegador. A ponte é o banco: a página de convite registra "alguém nesta rede, com um
 * aparelho assim, abriu o convite X" (recordInviteClick), e o app recém-aberto pergunta
 * "tem convite aberto na MINHA rede, com um aparelho assim?" (claimInviteHandoff).
 * Rede e aparelho são conferidos DENTRO do banco (supabase/migrations/20261006130000_*).
 *
 * O casamento é provável, não certo, por isso o app sempre confirma com a pessoa antes de
 * parear. Tudo aqui falha em silêncio: sem a ponte, o convite continua valendo pela conta.
 */

/**
 * Tamanho da tela do aparelho (menor x maior x densidade). O navegador e o app instalado
 * enxergam o MESMO valor, e a ordem menor/maior evita diferença por giro de tela.
 */
export function deviceScreenSignature(): string | null {
  try {
    const w = Math.round(window.screen.width);
    const h = Math.round(window.screen.height);
    if (!w || !h) return null;
    const dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
    return `${Math.min(w, h)}x${Math.max(w, h)}x${dpr}`;
  } catch {
    return null;
  }
}

/** Página de convite (navegador, sem login): deixa o recado pro app que será instalado. */
export async function recordInviteClick(code: string): Promise<void> {
  try {
    await supabase.rpc("record_invite_click", { p_code: code, p_screen: deviceScreenSignature() });
  } catch {
    /* sem rede ou função ainda não criada: o convite segue valendo pela conta */
  }
}

export type InviteHandoff = { code: string; firstName: string };

/**
 * App (com login): "algum convite foi aberto aqui perto de mim?". Devolve o convite ou null.
 * `ok` é false quando a pergunta nem chegou ao banco (sem rede, função ainda não criada):
 * aí vale tentar de novo depois, em vez de dar o assunto por encerrado.
 */
export async function claimInviteHandoff(): Promise<{ ok: boolean; handoff: InviteHandoff | null }> {
  try {
    const { data, error } = await supabase.rpc("claim_invite_handoff", { p_screen: deviceScreenSignature() });
    if (error) return { ok: false, handoff: null };
    const row = (data as { code: string; first_name: string }[] | null)?.[0];
    return { ok: true, handoff: row ? { code: row.code, firstName: row.first_name } : null };
  } catch {
    return { ok: false, handoff: null };
  }
}

const CHECKED_KEY = "drivon.passenger.handoffChecked";

/** Cada conta só pergunta UMA vez por instalação do app (o armazenamento zera ao reinstalar). */
export function handoffAlreadyChecked(userId: string): boolean {
  try {
    return localStorage.getItem(CHECKED_KEY) === userId;
  } catch {
    return true; // sem armazenamento não dá pra lembrar: melhor não perguntar do que perguntar sempre
  }
}

export function markHandoffChecked(userId: string): void {
  try {
    localStorage.setItem(CHECKED_KEY, userId);
  } catch {
    /* ignora */
  }
}

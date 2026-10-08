/**
 * "Esqueci minha senha". Só lógica (sem React), pra poder ser testada por scripts/recovery.test.ts.
 *
 * O caminho: a pessoa pede o link -> o Supabase manda um e-mail -> o link abre ESTE site
 * (RECOVERY_REDIRECT_URL) com `#access_token=...&type=recovery` -> o Supabase já entra na conta
 * sozinho (sessão de recuperação) -> o App mostra a tela "Nova senha" no lugar do app, até a
 * pessoa trocar a senha (ver auth-context.tsx e pages/ResetPassword.tsx).
 */
import { SITE_URL } from "./invite";

/**
 * Pra onde o link do e-mail leva. PRECISA estar na lista "Redirect URLs" do Supabase
 * (Authentication -> URL Configuration); se não estiver, o Supabase manda a pessoa pro site do
 * motorista e a recuperação não funciona.
 */
export const RECOVERY_REDIRECT_URL = SITE_URL;

/** Segundos até a pessoa poder pedir outro e-mail (o Supabase também segura pedidos seguidos). */
export const RESEND_SECONDS = 60;

export const LINK_ERROR_MESSAGE = "Esse link não vale mais (expirou ou já foi usado). Peça um novo em “Esqueci minha senha”.";

export type AuthLink = {
  /** O endereço trouxe um link de recuperação de senha válido (o Supabase vai criar a sessão). */
  recovery: boolean;
  /** Mensagem pronta quando o link do e-mail veio com erro (vencido, já usado...). */
  error: string | null;
};

/** Lê o que o Supabase deixa no endereço depois que a pessoa toca no link do e-mail. */
export function parseAuthLink(hash: string, search: string): AuthLink {
  const fromHash = new URLSearchParams(hash.replace(/^#/, ""));
  const fromSearch = new URLSearchParams(search.replace(/^\?/, ""));
  const get = (key: string) => fromHash.get(key) ?? fromSearch.get(key);

  const recovery = get("type") === "recovery" && Boolean(get("access_token"));
  if (recovery) return { recovery: true, error: null };

  const failed = Boolean(get("error") || get("error_code") || get("error_description"));
  return { recovery: false, error: failed ? LINK_ERROR_MESSAGE : null };
}

/** Regras da senha nova (as mesmas do cadastro: pelo menos 8 caracteres). */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (password !== confirm) return "As duas senhas não são iguais.";
  return null;
}

// ---------------------------------------------------------------------------
// "Estou no meio da recuperação": sobrevive a recarregar a página (o endereço é limpo
// pelo Supabase assim que ele lê o link, então só o endereço não basta).
// ---------------------------------------------------------------------------

const FLAG_KEY = "drivon.passenger.recovery";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

function store(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null; // navegador com armazenamento bloqueado
  }
}

export function markRecovery(): void {
  try {
    store()?.setItem(FLAG_KEY, "1");
  } catch {
    /* sem armazenamento: vale só até recarregar */
  }
}

export function isRecoveryPending(): boolean {
  try {
    return store()?.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearRecovery(): void {
  try {
    store()?.removeItem(FLAG_KEY);
  } catch {
    /* ignora */
  }
}

// ---------------------------------------------------------------------------
// Leitura do endereço na abertura do app.
// ---------------------------------------------------------------------------

let bootLink: AuthLink | undefined;

/**
 * Link de e-mail presente no endereço quando o app ABRIU. Lê uma única vez e lembra o resultado
 * (o React em desenvolvimento chama inicializadores duas vezes). Precisa rodar ANTES do Supabase
 * ler o endereço -- por isso é chamado em integrations/supabase/client.ts.
 */
export function getBootAuthLink(): AuthLink {
  if (bootLink === undefined) bootLink = captureAuthLinkFromLocation();
  return bootLink;
}

/** O aviso de link vencido só aparece uma vez: depois de mostrado, some (ex.: ao sair e entrar de novo). */
export function clearBootLinkError(): void {
  if (bootLink) bootLink = { ...bootLink, error: null };
}

/**
 * Lê o endereço atual: se for um link de recuperação, marca "estou recuperando a senha" (e deixa
 * o endereço quieto -- é o Supabase quem consome o `#access_token`). Se for um link com erro,
 * limpa o erro da barra de endereço pra ele não ficar grudado ao recarregar.
 */
export function captureAuthLinkFromLocation(): AuthLink {
  if (typeof window === "undefined") return { recovery: false, error: null };
  const link = parseAuthLink(window.location.hash, window.location.search);
  if (link.recovery) {
    markRecovery();
  } else if (link.error) {
    try {
      const url = new URL(window.location.href);
      for (const key of ["error", "error_code", "error_description"]) url.searchParams.delete(key);
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
    } catch {
      /* sem history API: segue com o endereço como está */
    }
  }
  return link;
}

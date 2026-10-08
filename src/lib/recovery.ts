/**
 * "Esqueci minha senha". Só lógica (sem React), pra poder ser testada por scripts/recovery.test.ts.
 *
 * O caminho (o e-mail é um modelo único do Supabase, ver supabase/email-templates no app do motorista):
 *  1. A pessoa pede o link -> o Supabase manda o e-mail com um botão que abre ESTE site
 *     (RECOVERY_REDIRECT_URL) com `?token_hash=...&type=recovery`, e o código de 6 números.
 *  2. A página mostra "Abrir no aplicativo" (e "Continuar no navegador"): o aplicativo instalado
 *     recebe o mesmo link por drivonpassageiro://p/recuperar?token_hash=... (ver native-recovery.ts).
 *  3. Dentro do app, o token vira uma sessão de recuperação (verifyOtp) e o App mostra a tela
 *     "Nova senha" no lugar do app, até a pessoa trocar a senha (auth-context.tsx, pages/ResetPassword.tsx).
 *
 * Também continua valendo o formato antigo (`#access_token=...&type=recovery`), caso um e-mail
 * mais velho ainda esteja na caixa da pessoa.
 */
import { APP_PACKAGE, APP_SCHEME, SITE_URL } from "./invite";

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
  /** O endereço trouxe um link ANTIGO de recuperação (`#access_token`): o Supabase já cria a sessão sozinho. */
  recovery: boolean;
  /** Mensagem pronta quando o link do e-mail veio com erro (vencido, já usado...). */
  error: string | null;
  /** Link NOVO do e-mail: o `token_hash` que vira sessão quando a pessoa confirma (verifyOtp). */
  tokenHash: string | null;
  /** O botão "Abrir no aplicativo" não achou o app e voltou pra cá (`sem_app=1`). */
  noApp: boolean;
};

const TOKEN_RE = /^[A-Za-z0-9_-]{16,200}$/;

function tokenFrom(params: URLSearchParams): string | null {
  if (params.get("type") !== "recovery") return null;
  const token = params.get("token_hash");
  return token && TOKEN_RE.test(token) ? token : null;
}

/** Lê o que o Supabase (ou o nosso e-mail) deixa no endereço depois que a pessoa toca no link. */
export function parseAuthLink(hash: string, search: string): AuthLink {
  const fromHash = new URLSearchParams(hash.replace(/^#/, ""));
  const fromSearch = new URLSearchParams(search.replace(/^\?/, ""));
  const get = (key: string) => fromHash.get(key) ?? fromSearch.get(key);

  const tokenHash = tokenFrom(fromSearch) ?? tokenFrom(fromHash);
  const noApp = fromSearch.get("sem_app") === "1";
  if (tokenHash) return { recovery: false, error: null, tokenHash, noApp };

  const recovery = get("type") === "recovery" && Boolean(get("access_token"));
  if (recovery) return { recovery: true, error: null, tokenHash: null, noApp: false };

  const failed = Boolean(get("error") || get("error_code") || get("error_description"));
  return { recovery: false, error: failed ? LINK_ERROR_MESSAGE : null, tokenHash: null, noApp: false };
}

/**
 * Tira o `token_hash` de um link completo: o que o aplicativo recebe do Android
 * (drivonpassageiro://p/recuperar?token_hash=...) ou o https da página. Null se não for de recuperação.
 */
export function parseRecoveryToken(raw: string | null | undefined): string | null {
  const text = raw?.trim();
  if (!text) return null;
  const q = text.indexOf("?");
  if (q < 0) return null;
  return tokenFrom(new URLSearchParams(text.slice(q + 1).split("#")[0]));
}

/** Página do site que abre quando a pessoa toca no botão do e-mail (e pra onde o Chrome volta sem o app). */
export function buildRecoveryPageUrl(tokenHash: string, opts: { noApp?: boolean } = {}): string {
  return `${SITE_URL}?token_hash=${encodeURIComponent(tokenHash)}&type=recovery${opts.noApp ? "&sem_app=1" : ""}`;
}

/**
 * Link que tenta ABRIR o app já instalado (Android/Chrome). O filtro do AndroidManifest aceita
 * drivonpassageiro://p/<qualquer coisa>, então "p/recuperar" abre o app sem precisar de APK novo.
 * Sem o app, o Chrome volta pra página com `sem_app=1` (que avisa e deixa continuar no navegador).
 */
export function buildOpenRecoveryAppUrl(tokenHash: string): string {
  const query = `token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
  const fallback = buildRecoveryPageUrl(tokenHash, { noApp: true });
  return (
    `intent://p/recuperar?${query}#Intent;scheme=${APP_SCHEME};package=${APP_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(fallback)};end`
  );
}

/** Código de números do e-mail: só os dígitos (tira espaços, traços...). Vazio se tiver letra. */
export function normalizeRecoveryCode(raw: string): string {
  return /^[\d\s-]*$/.test(raw) ? raw.replace(/\D/g, "") : "";
}

export function isValidRecoveryCode(code: string): boolean {
  return /^\d{6,8}$/.test(code);
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

/** Tira o token (e o resto do link de recuperação) da barra de endereço: já foi usado ou não vale mais. */
export function clearRecoveryParamsFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    for (const key of ["token_hash", "type", "sem_app", "error", "error_code", "error_description"]) {
      url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  } catch {
    /* sem history API: segue com o endereço como está */
  }
}

/**
 * Lê o endereço atual: se for um link ANTIGO de recuperação, marca "estou recuperando a senha" (e
 * deixa o endereço quieto -- é o Supabase quem consome o `#access_token`). Se for um link com erro,
 * limpa o erro da barra de endereço pra ele não ficar grudado ao recarregar. O link NOVO
 * (`?token_hash=`) fica no endereço até a pessoa confirmar (a página dele limpa depois).
 */
export function captureAuthLinkFromLocation(): AuthLink {
  if (typeof window === "undefined") return { recovery: false, error: null, tokenHash: null, noApp: false };
  const link = parseAuthLink(window.location.hash, window.location.search);
  if (link.recovery) {
    markRecovery();
  } else if (link.error) {
    clearRecoveryParamsFromUrl();
  }
  return link;
}

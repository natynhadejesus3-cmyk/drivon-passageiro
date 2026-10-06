/**
 * Convite por QR Code lido pela CÂMERA do celular.
 *
 * O QR do motorista é um link (`https://.../drivon-passageiro/?p=CODIGO`). A câmera
 * abre o link no navegador, que mostra a página de convite (Invite.tsx): quem não tem
 * o app vê o botão de baixar, quem tem abre direto nele. O código fica guardado aqui
 * até a pessoa entrar numa conta -- aí o app pareia sozinho (ver InviteAutoPair).
 *
 * Este arquivo é só lógica pura (sem React e sem `import.meta`) pra poder ser testado
 * por scripts/invite.test.ts.
 */

/** Endereço público do app do passageiro (mesmo de `server.url` no capacitor.config.ts). */
export const SITE_URL = "https://natynhadejesus3-cmyk.github.io/drivon-passageiro/";

/**
 * Link pra BAIXAR o app (Play Store ou o APK hospedado). Vazio = a página de convite
 * esconde o botão de baixar e deixa só "continuar no navegador".
 */
export const APP_DOWNLOAD_URL = "";

/** Pacote do app Android (capacitor.config.ts `appId`) e o endereço próprio que o abre. */
export const APP_PACKAGE = "com.drivon.passageiro";
export const APP_SCHEME = "drivonpassageiro";

const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/;

/** Link que vai dentro do QR do motorista (e que ele pode mandar por WhatsApp). */
export function buildInviteUrl(code: string): string {
  return `${SITE_URL}?p=${encodeURIComponent(code)}`;
}

function normalize(value: string | undefined | null): string | null {
  const code = value?.trim().toUpperCase();
  return code && CODE_RE.test(code) ? code : null;
}

/**
 * Tira o código de pareamento de QUALQUER forma que ele chegue:
 *  - o código puro:                 AB3D9FGHJK
 *  - o QR antigo (já impresso):     DRIVON-PAIR:AB3D9FGHJK
 *  - o link novo:                   https://.../drivon-passageiro/?p=AB3D9FGHJK  (ou /p/AB3D9FGHJK)
 *  - o endereço do app instalado:   drivonpassageiro://p/AB3D9FGHJK
 * Devolve null se não for um código válido (10 letras/números do alfabeto sem 0/O/1/I/L).
 */
export function parseInviteCode(raw: string | undefined | null): string | null {
  const text = raw?.trim();
  if (!text) return null;

  const legacy = text.match(/DRIVON-PAIR:\s*([A-Za-z0-9]+)/i);
  if (legacy) return normalize(legacy[1]);

  // Só aceita as formas de link quando o texto É um link (começa com esquema://), pra
  // não pescar "?p=..." de dentro de uma frase qualquer colada no campo manual.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    const query = text.match(/[?&]p=([A-Za-z0-9]+)/i);
    if (query) return normalize(query[1]);
    const path = text.match(/\/p\/([A-Za-z0-9]+)/i);
    if (path) return normalize(path[1]);
    return null;
  }

  return normalize(text);
}

/**
 * Link que tenta ABRIR o app já instalado (Android/Chrome). Se não houver app, o Chrome
 * vai pro `S.browser_fallback_url` -- o link de baixar, ou a própria página de convite
 * avisando que o app não está instalado. Sem esse fallback o Chrome tentaria abrir a
 * Play Store com o pacote, e daria "item não encontrado".
 */
export function buildOpenAppUrl(code: string): string {
  const fallback = APP_DOWNLOAD_URL || `${SITE_URL}?p=${encodeURIComponent(code)}&sem_app=1`;
  return (
    `intent://p/${code}#Intent;scheme=${APP_SCHEME};package=${APP_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(fallback)};end`
  );
}

// ---------------------------------------------------------------------------
// Convite pendente: o código espera aqui até a pessoa entrar numa conta.
// ---------------------------------------------------------------------------

const PENDING_KEY = "drivon.passenger.pendingInvite";
/** Convite esquecido por mais de 7 dias deixa de valer (evita parear sem querer, muito depois). */
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // navegador com armazenamento bloqueado
  }
}

export function savePendingInvite(code: string, now = Date.now()): void {
  try {
    store()?.setItem(PENDING_KEY, JSON.stringify({ code, savedAt: now }));
  } catch {
    /* sem armazenamento: o convite só vale nesta aba */
  }
}

export function readPendingInvite(now = Date.now()): string | null {
  try {
    const raw = store()?.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: unknown; savedAt?: unknown };
    const code = typeof parsed.code === "string" ? normalize(parsed.code) : null;
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0;
    if (!code || now - savedAt > PENDING_TTL_MS) {
      clearPendingInvite();
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    store()?.removeItem(PENDING_KEY);
  } catch {
    /* ignora */
  }
}

let bootInvite: ReturnType<typeof captureInviteFromLocation> | undefined;

/**
 * Convite presente no endereço quando o app ABRIU. Lê uma única vez e lembra o resultado:
 * o React em desenvolvimento chama o inicializador do estado duas vezes, e a 2ª leitura
 * já não acharia o `?p=` (a 1ª limpa a barra de endereço).
 */
export function getBootInvite(): { code: string; noApp: boolean } | null {
  if (bootInvite === undefined) bootInvite = captureInviteFromLocation();
  return bootInvite;
}

/**
 * Lê o endereço atual do navegador: se for um convite, guarda o código e devolve ele.
 * Também limpa o `?p=` da barra de endereço (o código já está guardado; assim recarregar
 * a página ou compartilhar o link dela não repete nem vaza o convite).
 */
export function captureInviteFromLocation(): { code: string; noApp: boolean } | null {
  if (typeof window === "undefined") return null;
  const code = parseInviteCode(window.location.href);
  if (!code) return null;
  savePendingInvite(code);
  // `sem_app=1` = o botão "Abrir no app" não achou o app instalado e voltou pra cá.
  const noApp = /[?&]sem_app=1\b/.test(window.location.search);
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("p");
    // `sem_app` só faz sentido junto com o convite.
    url.searchParams.delete("sem_app");
    // Forma /p/CODIGO (página aberta pelo 404.html do GitHub Pages): volta pra raiz do app.
    const path = url.pathname.replace(/\/p\/[A-Za-z0-9]+\/?$/, "/");
    window.history.replaceState(window.history.state, "", path + url.search + url.hash);
  } catch {
    /* sem history API: segue com a URL como está */
  }
  return { code, noApp };
}

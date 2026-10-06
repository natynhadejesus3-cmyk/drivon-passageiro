/**
 * Login do passageiro: aceita o @usuário do app do motorista OU o e-mail (mesma conta nos
 * dois apps). Lógica pura, com as dependências injetadas, pra ser testada por
 * scripts/login.test.ts. A versão ligada ao Supabase de verdade está em lib/passenger-login.ts.
 */

export type LoginTokens = { access_token: string; refresh_token: string };

export type LoginDeps = {
  /** POST no servidor (rota passenger-login do app do motorista). Lança se a rede/CORS falhar. */
  postLogin: (identifier: string, password: string) => Promise<{ status: number; body: unknown }>;
  /** Aplica a sessão devolvida pelo servidor. Devolve a mensagem de erro, se houver. */
  setSession: (tokens: LoginTokens) => Promise<string | null>;
  /** Plano B só para e-mail (servidor fora do ar): entra direto pelo Supabase. Devolve o erro, se houver. */
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
};

/** Texto digitado no campo: tira espaços e põe em minúsculas (usuário e e-mail não diferenciam maiúsculas). */
export function normalizeIdentifier(raw: string): string {
  return raw.trim().toLowerCase();
}

export function looksLikeEmail(identifier: string): boolean {
  return identifier.includes("@");
}

function isTokens(v: unknown): v is LoginTokens {
  const t = v as Partial<LoginTokens> | null;
  return !!t && typeof t.access_token === "string" && typeof t.refresh_token === "string";
}

/**
 * Entra na conta. Em caso de falha lança Error com mensagem pronta pra mostrar (em português,
 * ou "Failed to fetch" -- que errorMessage() traduz para "sem conexão").
 */
export async function loginWithIdentifier(rawIdentifier: string, password: string, deps: LoginDeps): Promise<void> {
  const identifier = normalizeIdentifier(rawIdentifier);
  if (!identifier || !password) throw new Error("Informe o usuário (ou e-mail) e a senha.");

  let res: { status: number; body: unknown } | null = null;
  try {
    res = await deps.postLogin(identifier, password);
  } catch {
    res = null; // sem rede, CORS, servidor fora do ar...
  }

  const body = (res?.body ?? null) as { ok?: boolean; error?: unknown } | null;
  const answered = !!body && typeof body.ok === "boolean";

  if (answered && body!.ok) {
    if (!isTokens(body)) throw new Error("Resposta inesperada do servidor. Tente de novo.");
    const sessionError = await deps.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
    if (sessionError) throw new Error(sessionError);
    return;
  }

  if (answered) {
    // O servidor respondeu "não": mensagem dele (já em português) e nada de plano B,
    // senão o bloqueio de tentativas seria contornado.
    throw new Error(typeof body!.error === "string" && body!.error ? body!.error : "Usuário ou senha inválidos.");
  }

  // Servidor não respondeu direito (rede, 5xx, página de erro). E-mail ainda entra direto
  // pelo Supabase; usuário depende do servidor (só ele acha o e-mail por trás).
  if (looksLikeEmail(identifier)) {
    const direct = await deps.signInWithEmail(identifier, password);
    if (direct) throw new Error(direct);
    return;
  }
  throw new TypeError("Failed to fetch");
}

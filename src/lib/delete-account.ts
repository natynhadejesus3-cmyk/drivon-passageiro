/**
 * Excluir a conta (exigência da LGPD e das lojas). A exclusão de verdade acontece no servidor do app
 * do motorista (mesma conta nos dois apps): lib/account/delete-account.server.ts, lá. Aqui só o pedido.
 */
const DELETE_URL = "https://natynhadejesus3-cmyk-comfort-code-cave.canalgringo028.workers.dev/api/public/delete-account";
const TIMEOUT_MS = 30_000;

type AccountLike = {
  identities?: Array<{ provider?: string }> | null;
  app_metadata?: { providers?: string[]; provider?: string } | null;
};

/** A conta tem senha? (conta criada só pelo Google não tem: aí a confirmação é digitar o e-mail.) */
export function hasPasswordLogin(user: AccountLike): boolean {
  if (user.identities?.length) return user.identities.some((i) => i.provider === "email");
  const providers = user.app_metadata?.providers ?? (user.app_metadata?.provider ? [user.app_metadata.provider] : []);
  return providers.includes("email");
}

export async function requestAccountDeletion(input: {
  accessToken: string;
  password?: string;
  confirmEmail?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // text/plain evita o pré-voo OPTIONS; o servidor lê o corpo como texto.
    const res = await fetch(DELETE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain", Authorization: `Bearer ${input.accessToken}` },
      body: JSON.stringify({ password: input.password ?? "", confirmEmail: input.confirmEmail ?? "" }),
      signal: ctrl.signal,
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (res.ok && data?.ok) return { ok: true };
    return { ok: false, error: data?.error ?? "Não foi possível excluir agora. Tente de novo em instantes." };
  } catch {
    return { ok: false, error: "Sem conexão com a internet. Confira e tente de novo." };
  } finally {
    clearTimeout(timer);
  }
}

// Aviso de uma vez só pra tela de entrada ("Sua conta foi excluída."): sobrevive à troca de tela.
const FLASH_KEY = "drivon.passenger.flash";

export function setFlash(message: string): void {
  try {
    sessionStorage.setItem(FLASH_KEY, message);
  } catch {
    /* sem armazenamento: o aviso simplesmente não aparece */
  }
}

export function peekFlash(): string | null {
  try {
    return sessionStorage.getItem(FLASH_KEY);
  } catch {
    return null;
  }
}

export function clearFlash(): void {
  try {
    sessionStorage.removeItem(FLASH_KEY);
  } catch {
    /* ignora */
  }
}

/**
 * "Esqueci minha senha". Só lógica (sem React), pra poder ser testada por scripts/recovery.test.ts.
 *
 * O caminho, sem link: a pessoa pede o e-mail -> o Supabase manda um código de números (modelo do
 * e-mail em supabase/email-templates, no app do motorista) -> ela digita o código na própria tela
 * "Esqueci minha senha" (ForgotPassword.tsx) -> o código vira uma sessão de recuperação (verifyOtp)
 * -> o App mostra a tela "Nova senha" no lugar do app, até a pessoa trocar a senha
 * (auth-context.tsx, pages/ResetPassword.tsx).
 */

/** Segundos até a pessoa poder pedir outro e-mail (o Supabase também segura pedidos seguidos). */
export const RESEND_SECONDS = 60;

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
// "Estou no meio da recuperação": sobrevive a recarregar a página (a sessão de recuperação é uma
// sessão comum, então sem esta marca o app abriria direto, sem pedir a senha nova).
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

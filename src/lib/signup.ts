/**
 * Regras do cadastro em etapas (components/auth/SignupWizard.tsx). Ficam aqui, sem React,
 * pra poderem ser testadas por scripts/signup.test.ts.
 */

export const SIGNUP_STEPS = ["name", "email", "password", "photo"] as const;
export type SignupStepKey = (typeof SIGNUP_STEPS)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Primeiro nome, já com a inicial maiúscula (quem digita "maria" lê "Olá, Maria"). */
export function firstNameOf(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  return first.charAt(0).toLocaleUpperCase("pt-BR") + first.slice(1);
}

/** Pontuação 0..4 da força da senha (barrinha colorida da etapa de senha). */
export function passwordScore(p: string): number {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

export const STRENGTH_LABEL = ["Muito curta", "Fraca", "Média", "Boa", "Forte"] as const;

/** Texto da força: sem senha, nada; com 8+ caracteres, no mínimo "Fraca". */
export function strengthLabel(password: string): string {
  if (!password) return "";
  return STRENGTH_LABEL[Math.max(passwordScore(password), password.length >= 8 ? 1 : 0)] ?? "";
}

/** Validação de cada etapa. Devolve a mensagem de erro ou null se pode seguir. */
export function validateStep(step: SignupStepKey, v: { name: string; email: string; password: string }): string | null {
  switch (step) {
    case "name":
      return v.name.trim().length < 2 ? "Conta pra gente o seu nome." : null;
    case "email":
      return isValidEmail(v.email) ? null : "Esse e-mail não parece certo.";
    case "password":
      return v.password.length < 8 ? "A senha precisa ter pelo menos 8 caracteres." : null;
    default:
      return null;
  }
}

/**
 * Para onde vai o "Continuar" da etapa `current`. Normalmente é a próxima. Mas se a pessoa
 * VOLTOU pra corrigir algo (ou foi devolvida por um erro na criação da conta), o "Continuar"
 * leva direto de volta até onde ela tinha chegado (`furthest`), em vez de refazer as etapas
 * do meio. Só pula etapas cujos dados continuam válidos: se alguma estiver inválida, para nela.
 */
export function nextStepIndex(
  current: number,
  furthest: number,
  v: { name: string; email: string; password: string },
): number {
  const first = current + 1;
  const target = Math.min(Math.max(first, furthest), SIGNUP_STEPS.length - 1);
  for (let i = first; i < target; i++) {
    if (validateStep(SIGNUP_STEPS[i]!, v)) return i;
  }
  return target;
}

/**
 * Se a criação da conta falhar, volta pra etapa do campo com problema em vez de deixar a
 * pessoa perdida na última tela. Recebe a mensagem JÁ em português (errorMessage()).
 */
export function stepForSignupError(message: string): "email" | "password" | null {
  if (/e-?mail/i.test(message)) return "email";
  if (/senha/i.test(message)) return "password";
  return null;
}

/**
 * Mensagens de erro em português. O Supabase e o navegador devolvem texto em
 * inglês ("Invalid login credentials", "Failed to fetch"...) e o passageiro
 * estava vendo isso na tela.
 *
 * Só TRADUZ o que reconhece. Qualquer outra mensagem passa como veio (as nossas,
 * já em português, ficam intactas); mensagem vazia vira o `fallback`.
 */
const RULES: Array<[RegExp, string]> = [
  [/invalid pairing code/i, "Código de pareamento inválido. Confira o código com o motorista."],
  [/not authenticated/i, "Entre na sua conta para continuar."],
  [/invalid login credentials|invalid credentials/i, "E-mail ou senha incorretos."],
  [/user already registered|already been registered|already exists/i, "Esse e-mail já está cadastrado. Tente entrar."],
  [/email not confirmed/i, "Confirme seu e-mail pelo link que enviamos antes de entrar."],
  [/should be different from the old|different from the old password|same password/i, "A nova senha precisa ser diferente da antiga."],
  [/password should be at least|password.*(too short|least \d+)/i, "A senha é muito curta. Use pelo menos 8 caracteres."],
  [/\b(weak|pwned|compromised)\b|known to be/i, "Essa senha é fraca ou já apareceu em vazamentos. Escolha outra."],
  [/auth session missing|session.*(expired|missing)|jwt expired/i, "O link de recuperação expirou ou já foi usado. Volte ao login e peça um novo em “Esqueci minha senha”."],
  [/rate limit|too many requests|over_email_send_rate_limit|for security purposes/i, "Muitas tentativas seguidas. Aguarde um pouco e tente de novo."],
  [/failed to fetch|networkerror|load failed|network request failed|fetch failed/i, "Sem conexão com a internet. Confira e tente de novo."],
  [/database error saving new user|database error creating new user/i, "Não foi possível criar a conta com esse e-mail. Confira se é um e-mail pessoal e tente de novo."],
  [/signups? not allowed|signup.*disabled/i, "Cadastros indisponíveis no momento."],
  [/unable to validate email|invalid.*email|email address.*invalid/i, "Esse e-mail não parece válido."],
];

export function errorMessage(raw: unknown, fallback = "Não foi possível continuar. Tente de novo."): string {
  // Erros do Supabase (PostgrestError, AuthError...) nem sempre são `Error` de verdade: às vezes
  // vêm como objeto simples com `message`. Sem isso a mensagem era ignorada e caía no texto de reserva.
  const objMessage = (raw as { message?: unknown } | null)?.message;
  const msg = raw instanceof Error ? raw.message : typeof raw === "string" ? raw : typeof objMessage === "string" ? objMessage : "";
  if (!msg.trim()) return fallback;
  for (const [re, pt] of RULES) if (re.test(msg)) return pt;
  return msg;
}

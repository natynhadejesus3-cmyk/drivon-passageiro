/**
 * Validação do "Esqueci minha senha" só com código (código do e-mail, senha nova, marca de recuperação).
 * Rodar com: bun run scripts/recovery.test.ts
 */
import { errorMessage } from "../src/lib/error-messages";
import {
  RESEND_SECONDS,
  clearRecovery,
  isRecoveryPending,
  isValidRecoveryCode,
  markRecovery,
  normalizeRecoveryCode,
  validateNewPassword,
} from "../src/lib/recovery";

const results: string[] = [];
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? "PASS" : "FAIL"} — ${name}${ok ? "" : ` (esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)})`}`);
  if (!ok) process.exitCode = 1;
}

check("espera 60s pra pedir outro e-mail", RESEND_SECONDS, 60);

// --- Código de números do e-mail ---------------------------------------------------------
check("código: tira espaços e traços (colado do e-mail)", [normalizeRecoveryCode("123 456"), normalizeRecoveryCode("123-456"), normalizeRecoveryCode(" 123456 ")], ["123456", "123456", "123456"]);
check("código com letra vira vazio (nada de colar texto aqui)", [normalizeRecoveryCode("12ab56"), normalizeRecoveryCode("https://x")], ["", ""]);
check("código vazio fica vazio", normalizeRecoveryCode(""), "");
check("código válido: 6 a 8 números", ["12345", "123456", "12345678", "123456789", ""].map(isValidRecoveryCode), [false, true, true, false, false]);

// --- Senha nova --------------------------------------------------------------------------
check("senha curta é recusada", validateNewPassword("1234567", "1234567"), "A senha precisa ter pelo menos 8 caracteres.");
check("senhas diferentes são recusadas", validateNewPassword("12345678", "12345679"), "As duas senhas não são iguais.");
check("8 caracteres iguais: ok", validateNewPassword("12345678", "12345678"), null);
check("vazia é recusada", validateNewPassword("", ""), "A senha precisa ter pelo menos 8 caracteres.");

// --- Mensagens do Supabase que a pessoa pode ver -----------------------------------------
const EXPIRED = "Esse código ou link não vale mais (expirou ou já foi usado). Peça um novo em “Esqueci minha senha”.";
check("pedidos seguidos: aviso em português", errorMessage(new Error("For security purposes, you can only request this after 59 seconds.")), "Muitas tentativas seguidas. Aguarde um pouco e tente de novo.");
check("limite de e-mails: aviso em português", errorMessage({ message: "email rate limit exceeded" }), "Muitas tentativas seguidas. Aguarde um pouco e tente de novo.");
check("código errado/vencido: aviso em português", [errorMessage(new Error("Token has expired or is invalid")), errorMessage({ message: "Email link is invalid or has expired" })], [EXPIRED, EXPIRED]);
check("senha igual à antiga: aviso em português", errorMessage(new Error("New password should be different from the old password.")), "A nova senha precisa ser diferente da antiga.");
check("senha fraca/vazada: aviso em português", errorMessage(new Error("Password is known to be weak and easy to guess, please choose a different one.")), "Essa senha é fraca ou já apareceu em vazamentos. Escolha outra.");
check("sessão perdida na troca: manda pedir código novo", errorMessage(new Error("Auth session missing!")), "O link de recuperação expirou ou já foi usado. Volte ao login e peça um novo em “Esqueci minha senha”.");
check("sem internet: aviso em português", errorMessage(new TypeError("Failed to fetch")), "Sem conexão com a internet. Confira e tente de novo.");

// --- Marca "estou recuperando a senha" (sessionStorage) ----------------------------------
const mem = new Map<string, string>();
(globalThis as unknown as { sessionStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> }).sessionStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => void mem.set(k, v),
  removeItem: (k) => void mem.delete(k),
};
check("começa sem marca", isRecoveryPending(), false);
markRecovery();
check("marca guardada", isRecoveryPending(), true);
clearRecovery();
check("marca apagada", isRecoveryPending(), false);

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram`);

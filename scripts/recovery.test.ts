/**
 * Validação do "Esqueci minha senha" (leitura do link do e-mail, senha nova, marca de recuperação).
 * Rodar com: bun run scripts/recovery.test.ts
 */
import { errorMessage } from "../src/lib/error-messages";
import { SITE_URL } from "../src/lib/invite";
import {
  LINK_ERROR_MESSAGE,
  RECOVERY_REDIRECT_URL,
  RESEND_SECONDS,
  captureAuthLinkFromLocation,
  clearRecovery,
  isRecoveryPending,
  markRecovery,
  parseAuthLink,
  validateNewPassword,
} from "../src/lib/recovery";

const results: string[] = [];
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? "PASS" : "FAIL"} — ${name}${ok ? "" : ` (esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)})`}`);
  if (!ok) process.exitCode = 1;
}

// --- Para onde o link do e-mail leva -----------------------------------------------------
check("o link do e-mail volta pro site do passageiro", RECOVERY_REDIRECT_URL, SITE_URL);
check("o endereço é do GitHub Pages do passageiro e termina em /", [RECOVERY_REDIRECT_URL.startsWith("https://"), RECOVERY_REDIRECT_URL.endsWith("/drivon-passageiro/")], [true, true]);
check("espera 60s pra pedir outro e-mail", RESEND_SECONDS, 60);

// --- Leitura do endereço -----------------------------------------------------------------
const okHash = "#access_token=AAA.BBB.CCC&expires_in=3600&refresh_token=RRR&token_type=bearer&type=recovery";
check("link de recuperação válido é reconhecido", parseAuthLink(okHash, ""), { recovery: true, error: null });
check("link de recuperação sem o # também é reconhecido", parseAuthLink(okHash.slice(1), "").recovery, true);
check("type=recovery sem token NÃO vale", parseAuthLink("#type=recovery", ""), { recovery: false, error: null });
check("outro tipo de link (cadastro) não é recuperação", parseAuthLink("#access_token=A&refresh_token=R&type=signup", ""), { recovery: false, error: null });
check("endereço normal: nada a fazer", parseAuthLink("", ""), { recovery: false, error: null });
check("convite (?p=) não confunde", parseAuthLink("", "?p=AB3D9FGHJK"), { recovery: false, error: null });
check(
  "link vencido (erro do Supabase no #) vira aviso em português",
  parseAuthLink("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=", ""),
  { recovery: false, error: LINK_ERROR_MESSAGE },
);
check("erro na query (?error=...) também vira aviso", parseAuthLink("", "?error=access_denied&error_code=otp_expired").error, LINK_ERROR_MESSAGE);
check("o aviso manda pedir um link novo", /Esqueci minha senha/.test(LINK_ERROR_MESSAGE), true);

// --- Senha nova --------------------------------------------------------------------------
check("senha curta é recusada", validateNewPassword("1234567", "1234567"), "A senha precisa ter pelo menos 8 caracteres.");
check("senhas diferentes são recusadas", validateNewPassword("12345678", "12345679"), "As duas senhas não são iguais.");
check("8 caracteres iguais: ok", validateNewPassword("12345678", "12345678"), null);
check("vazia é recusada", validateNewPassword("", ""), "A senha precisa ter pelo menos 8 caracteres.");

// --- Mensagens do Supabase que a pessoa pode ver ----------------------------------------
check("pedidos seguidos: aviso em português", errorMessage(new Error("For security purposes, you can only request this after 59 seconds.")), "Muitas tentativas seguidas. Aguarde um pouco e tente de novo.");
check("limite de e-mails: aviso em português", errorMessage({ message: "email rate limit exceeded" }), "Muitas tentativas seguidas. Aguarde um pouco e tente de novo.");
check("senha igual à antiga: aviso em português", errorMessage(new Error("New password should be different from the old password.")), "A nova senha precisa ser diferente da antiga.");
check("senha fraca/vazada: aviso em português", errorMessage(new Error("Password is known to be weak and easy to guess, please choose a different one.")), "Essa senha é fraca ou já apareceu em vazamentos. Escolha outra.");
check("sessão perdida na troca: manda pedir link novo", errorMessage(new Error("Auth session missing!")), "O link de recuperação expirou ou já foi usado. Volte ao login e peça um novo em “Esqueci minha senha”.");
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

// --- Captura do endereço na abertura do app (com `window` de mentira) --------------------
function fakeWindow(hash: string, search: string) {
  const calls: string[] = [];
  const loc = {
    hash,
    search,
    pathname: "/drivon-passageiro/",
    href: `https://natynhadejesus3-cmyk.github.io/drivon-passageiro/${search}${hash}`,
  };
  (globalThis as unknown as { window: unknown }).window = {
    location: loc,
    history: { state: null, replaceState: (_s: unknown, _t: string, url: string) => void calls.push(url) },
  };
  return calls;
}

let calls = fakeWindow(okHash, "");
check("abrir pelo link do e-mail: reconhece e marca a recuperação", [captureAuthLinkFromLocation().recovery, isRecoveryPending()], [true, true]);
check("... e NÃO mexe no endereço (o Supabase é quem lê o token)", calls.length, 0);
clearRecovery();

calls = fakeWindow("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid", "");
const expired = captureAuthLinkFromLocation();
check("abrir por link vencido: devolve o aviso e não marca recuperação", [expired.error, expired.recovery, isRecoveryPending()], [LINK_ERROR_MESSAGE, false, false]);
check("... e limpa o erro da barra de endereço", calls, ["/drivon-passageiro/"]);

calls = fakeWindow("", "");
check("abrir normal: nada acontece", [captureAuthLinkFromLocation(), calls.length, isRecoveryPending()], [{ recovery: false, error: null }, 0, false]);

delete (globalThis as unknown as { window?: unknown }).window;

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram`);

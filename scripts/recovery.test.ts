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
  buildOpenRecoveryAppUrl,
  buildRecoveryPageUrl,
  captureAuthLinkFromLocation,
  clearRecovery,
  isRecoveryPending,
  isValidRecoveryCode,
  markRecovery,
  normalizeRecoveryCode,
  parseAuthLink,
  parseRecoveryToken,
  validateNewPassword,
} from "../src/lib/recovery";

const NONE = { recovery: false, error: null, tokenHash: null, noApp: false };
// Parecido com o token_hash de verdade do Supabase (64 caracteres hexadecimais).
const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

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
check("link ANTIGO de recuperação (#access_token) é reconhecido", parseAuthLink(okHash, ""), { ...NONE, recovery: true });
check("link antigo sem o # também é reconhecido", parseAuthLink(okHash.slice(1), "").recovery, true);
check("type=recovery sem token NÃO vale", parseAuthLink("#type=recovery", ""), NONE);
check("outro tipo de link (cadastro) não é recuperação", parseAuthLink("#access_token=A&refresh_token=R&type=signup", ""), NONE);
check("endereço normal: nada a fazer", parseAuthLink("", ""), NONE);
check("convite (?p=) não confunde", parseAuthLink("", "?p=AB3D9FGHJK"), NONE);
check(
  "link vencido (erro do Supabase no #) vira aviso em português",
  parseAuthLink("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=", ""),
  { ...NONE, error: LINK_ERROR_MESSAGE },
);

// --- Link NOVO do e-mail (?token_hash=...&type=recovery) ---------------------------------
check("link novo do e-mail traz o token", parseAuthLink("", `?token_hash=${TOKEN}&type=recovery`), { ...NONE, tokenHash: TOKEN });
check("link novo sem o ?", parseAuthLink("", `token_hash=${TOKEN}&type=recovery`).tokenHash, TOKEN);
check("volta do 'Abrir no aplicativo' sem o app (sem_app=1)", parseAuthLink("", `?token_hash=${TOKEN}&type=recovery&sem_app=1`), { ...NONE, tokenHash: TOKEN, noApp: true });
check("token sem type=recovery NÃO vale", parseAuthLink("", `?token_hash=${TOKEN}`).tokenHash, null);
check("type=signup NÃO vale", parseAuthLink("", `?token_hash=${TOKEN}&type=signup`).tokenHash, null);
check("token curto/estranho NÃO vale", [parseAuthLink("", "?token_hash=abc&type=recovery").tokenHash, parseAuthLink("", `?token_hash=${TOKEN}<script>&type=recovery`).tokenHash], [null, null]);

// --- Link que o Android entrega ao aplicativo --------------------------------------------
const appLink = `drivonpassageiro://p/recuperar?token_hash=${TOKEN}&type=recovery`;
check("deep link do app traz o token", parseRecoveryToken(appLink), TOKEN);
check("o https da página também traz o token", parseRecoveryToken(`https://natynhadejesus3-cmyk.github.io/drivon-passageiro/?token_hash=${TOKEN}&type=recovery`), TOKEN);
check("deep link com # no fim", parseRecoveryToken(`${appLink}#Intent;end`), TOKEN);
check("convite do motorista NÃO é recuperação", [parseRecoveryToken("drivonpassageiro://p/AB3D9FGHJK"), parseRecoveryToken("https://x.test/?p=AB3D9FGHJK")], [null, null]);
check("vazio / nulo", [parseRecoveryToken(""), parseRecoveryToken(null), parseRecoveryToken(undefined)], [null, null, null]);
check("deep link sem type=recovery NÃO vale", parseRecoveryToken(`drivonpassageiro://p/recuperar?token_hash=${TOKEN}`), null);

check("página do e-mail: endereço do site + token", buildRecoveryPageUrl(TOKEN), `${SITE_URL}?token_hash=${TOKEN}&type=recovery`);
check("página sem app: leva sem_app=1", buildRecoveryPageUrl(TOKEN, { noApp: true }), `${SITE_URL}?token_hash=${TOKEN}&type=recovery&sem_app=1`);
const openApp = buildOpenRecoveryAppUrl(TOKEN);
check("'Abrir no aplicativo' usa o endereço que o app já escuta (drivonpassageiro://p/...)", openApp.startsWith("intent://p/recuperar?token_hash="), true);
check("... com o pacote e o esquema certos", [openApp.includes("scheme=drivonpassageiro;"), openApp.includes("package=com.drivon.passageiro;")], [true, true]);
check("... e, sem o app, volta pra página com sem_app=1", decodeURIComponent(openApp.split("S.browser_fallback_url=")[1]!.replace(";end", "")), `${SITE_URL}?token_hash=${TOKEN}&type=recovery&sem_app=1`);
check("o que o botão manda, o app entende (ida e volta)", parseRecoveryToken(openApp.replace("intent://", "drivonpassageiro://").split("#")[0]), TOKEN);

// --- Código de números do e-mail ---------------------------------------------------------
check("código: tira espaços e traços", [normalizeRecoveryCode("123 456"), normalizeRecoveryCode("123-456"), normalizeRecoveryCode(" 123456 ")], ["123456", "123456", "123456"]);
check("código com letra vira vazio (nada de colar o link aqui)", [normalizeRecoveryCode("12ab56"), normalizeRecoveryCode("https://x")], ["", ""]);
check("código válido: 6 a 8 números", ["12345", "123456", "12345678", "123456789"].map(isValidRecoveryCode), [false, true, true, false]);
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
check("código/link vencido do e-mail: aviso em português", [errorMessage(new Error("Token has expired or is invalid")), errorMessage(new Error("Email link is invalid or has expired"))], ["Esse código ou link não vale mais (expirou ou já foi usado). Peça um novo em “Esqueci minha senha”.", "Esse código ou link não vale mais (expirou ou já foi usado). Peça um novo em “Esqueci minha senha”."]);
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
check("abrir normal: nada acontece", [captureAuthLinkFromLocation(), calls.length, isRecoveryPending()], [NONE, 0, false]);

delete (globalThis as unknown as { window?: unknown }).window;

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram`);

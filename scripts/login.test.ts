/**
 * Validação do login do passageiro (@usuário ou e-mail, via servidor, com plano B).
 * Rodar com: bun run scripts/login.test.ts
 */
import { errorMessage } from "../src/lib/error-messages";
import { loginWithIdentifier, looksLikeEmail, normalizeIdentifier, type LoginDeps } from "../src/lib/login-core";

const results: string[] = [];
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? "PASS" : "FAIL"} — ${name}${ok ? "" : ` (esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)})`}`);
  if (!ok) process.exitCode = 1;
}

type Spy = { posts: string[][]; sessions: unknown[]; direct: string[][] };
function makeDeps(server: "ok" | "wrong" | "blocked" | "down" | "html" | "badtokens", extra: { sessionError?: string; directError?: string } = {}) {
  const spy: Spy = { posts: [], sessions: [], direct: [] };
  const deps: LoginDeps = {
    postLogin: async (id, pw) => {
      spy.posts.push([id, pw]);
      if (server === "down") throw new TypeError("Failed to fetch");
      if (server === "html") return { status: 502, body: null };
      if (server === "ok") return { status: 200, body: { ok: true, access_token: "AT", refresh_token: "RT" } };
      if (server === "badtokens") return { status: 200, body: { ok: true } };
      if (server === "blocked") return { status: 429, body: { ok: false, error: "Muitas tentativas de login. Tente de novo em 15 minutos.", retryAfterSec: 900 } };
      return { status: 401, body: { ok: false, error: "Usuário ou senha inválidos." } };
    },
    setSession: async (t) => {
      spy.sessions.push(t);
      return extra.sessionError ?? null;
    },
    signInWithEmail: async (e, p) => {
      spy.direct.push([e, p]);
      return extra.directError ?? null;
    },
  };
  return { deps, spy };
}
async function attempt(fn: () => Promise<void>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return errorMessage(e);
  }
}

check("normaliza (espaços e maiúsculas)", normalizeIdentifier("  Joao_Motorista "), "joao_motorista");
check("reconhece e-mail", [looksLikeEmail("a@b.com"), looksLikeEmail("joao_motorista")], [true, false]);

// ---- o caso pedido: usuário do app do motorista entra ----
{
  const { deps, spy } = makeDeps("ok");
  const err = await attempt(() => loginWithIdentifier("  Joao_Motorista ", "SenhaDoJoao1!", deps));
  check("@usuário entra", err, null);
  check("manda pro servidor o usuário já normalizado, e a senha INTACTA", spy.posts, [["joao_motorista", "SenhaDoJoao1!"]]);
  check("aplica a sessão devolvida pelo servidor", spy.sessions, [{ access_token: "AT", refresh_token: "RT" }]);
  check("não usou o plano B", spy.direct.length, 0);
}
{
  const { deps, spy } = makeDeps("ok");
  check("e-mail também entra pelo servidor (mesmo bloqueio de tentativas)", [await attempt(() => loginWithIdentifier("Maria@Exemplo.com", "x12345678", deps)), spy.posts[0]], [null, ["maria@exemplo.com", "x12345678"]]);
}

// ---- falhas: mensagem do servidor, sem plano B (senão o bloqueio seria contornado) ----
{
  const { deps, spy } = makeDeps("wrong");
  check("senha errada: mostra a mensagem do servidor", await attempt(() => loginWithIdentifier("maria@exemplo.com", "errada", deps)), "Usuário ou senha inválidos.");
  check("senha errada de E-MAIL NÃO cai no plano B (não contorna o limite)", [spy.direct.length, spy.sessions.length], [0, 0]);
}
{
  const { deps, spy } = makeDeps("blocked");
  check("bloqueado: mostra o tempo de espera", await attempt(() => loginWithIdentifier("maria@exemplo.com", "x12345678", deps)), "Muitas tentativas de login. Tente de novo em 15 minutos.");
  check("bloqueado: nada de plano B", spy.direct.length, 0);
}

// ---- servidor fora do ar ----
{
  const { deps, spy } = makeDeps("down");
  check("servidor fora + E-MAIL: entra direto pelo Supabase (plano B)", [await attempt(() => loginWithIdentifier("maria@exemplo.com", "x12345678", deps)), spy.direct], [null, [["maria@exemplo.com", "x12345678"]]]);
}
{
  const { deps } = makeDeps("html");
  check("servidor devolveu página de erro + e-mail: plano B também", await attempt(() => loginWithIdentifier("maria@exemplo.com", "x12345678", deps)), null);
}
{
  const { deps } = makeDeps("down", { directError: "Invalid login credentials" });
  check("plano B com senha errada: mensagem em português", await attempt(() => loginWithIdentifier("maria@exemplo.com", "errada", deps)), "E-mail ou senha incorretos.");
}
{
  const { deps, spy } = makeDeps("down");
  check("servidor fora + @USUÁRIO: avisa que está sem conexão (só o servidor acha o e-mail)", await attempt(() => loginWithIdentifier("joao_motorista", "x12345678", deps)), "Sem conexão com a internet. Confira e tente de novo.");
  check("...e não tenta nada direto", spy.direct.length, 0);
}

// ---- entradas ruins e respostas estranhas ----
{
  const { deps, spy } = makeDeps("ok");
  check("campos vazios nem chamam o servidor", [await attempt(() => loginWithIdentifier("   ", "x", deps)), await attempt(() => loginWithIdentifier("maria", "", deps)), spy.posts.length], ["Informe o usuário (ou e-mail) e a senha.", "Informe o usuário (ou e-mail) e a senha.", 0]);
}
{
  const { deps } = makeDeps("badtokens");
  check("servidor diz ok mas sem tokens: erro claro (não entra pela metade)", await attempt(() => loginWithIdentifier("maria@exemplo.com", "x12345678", deps)), "Resposta inesperada do servidor. Tente de novo.");
}
{
  const { deps } = makeDeps("ok", { sessionError: "Invalid Refresh Token" });
  check("falha ao aplicar a sessão aparece pro usuário", (await attempt(() => loginWithIdentifier("maria@exemplo.com", "x12345678", deps))) !== null, true);
}

console.log(results.join("\n"));

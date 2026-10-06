/**
 * Validação da leitura do convite (QR por câmera) e do convite pendente.
 * Rodar com: bun run scripts/invite.test.ts
 */
import {
  APP_DOWNLOAD_URL,
  APP_PACKAGE,
  APP_SCHEME,
  SITE_URL,
  buildInviteUrl,
  buildOpenAppUrl,
  clearPendingInvite,
  parseInviteCode,
  readPendingInvite,
  savePendingInvite,
} from "../src/lib/invite";

const results: string[] = [];
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? "PASS" : "FAIL"} — ${name}${ok ? "" : ` (esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)})`}`);
  if (!ok) process.exitCode = 1;
}

const CODE = "AB3D9FGHJK";

// ---- leitura do código, em todas as formas que ele pode chegar ----
check("código puro", parseInviteCode(CODE), CODE);
check("código puro em minúsculas e com espaços", parseInviteCode(`  ${CODE.toLowerCase()}  `), CODE);
check("QR antigo (já impresso/mostrado) continua valendo", parseInviteCode(`DRIVON-PAIR:${CODE}`), CODE);
check("QR antigo com espaço depois dos dois pontos", parseInviteCode(`DRIVON-PAIR: ${CODE}`), CODE);
check("link novo (?p=)", parseInviteCode(`${SITE_URL}?p=${CODE}`), CODE);
check("link novo com outros parâmetros antes", parseInviteCode(`${SITE_URL}?utm=x&p=${CODE}`), CODE);
check("link novo em minúsculas", parseInviteCode(`${SITE_URL}?p=${CODE.toLowerCase()}`), CODE);
check("link no formato /p/CODIGO", parseInviteCode(`${SITE_URL}p/${CODE}`), CODE);
check("endereço do app instalado", parseInviteCode(`${APP_SCHEME}://p/${CODE}`), CODE);
check("o link que o próprio motorista gera é lido de volta", parseInviteCode(buildInviteUrl(CODE)), CODE);

// ---- coisas que NÃO são convite ----
check("vazio / null / undefined", [parseInviteCode(""), parseInviteCode(null), parseInviteCode(undefined)], [null, null, null]);
check("curto demais", parseInviteCode("AB3D9"), null);
check("longo demais", parseInviteCode(`${CODE}X`), null);
check("caractere proibido no alfabeto (0, O, 1, I, L)", parseInviteCode("AB3D9FGHJ0"), null);
check("link sem convite", parseInviteCode(SITE_URL), null);
check("link com ?p= inválido", parseInviteCode(`${SITE_URL}?p=curto`), null);
check("frase solta que menciona ?p= NÃO vira convite", parseInviteCode(`olha isso ?p=${CODE} ok`), null);
check("outro site com ?p= de 10 caracteres também é lido (é só o formato do link)", parseInviteCode(`https://exemplo.com/?p=${CODE}`), CODE);

// ---- link do QR ----
check("link do QR termina com o código", buildInviteUrl(CODE), `${SITE_URL}?p=${CODE}`);
const open = buildOpenAppUrl(CODE);
check("'Abrir no app' usa intent com o pacote certo", open.startsWith(`intent://p/${CODE}#Intent;scheme=${APP_SCHEME};package=${APP_PACKAGE};`), true);
check("'Abrir no app' tem fallback (senão o Chrome tenta abrir a Play Store)", open.includes("S.browser_fallback_url="), true);
// Sem o app instalado, o Chrome segue pro fallback: o link de baixar (quando existe) ou a própria página de convite.
const fallbackUrl = decodeURIComponent(open.split("S.browser_fallback_url=")[1].replace(";end", ""));
check(
  APP_DOWNLOAD_URL ? "o fallback leva direto pro download do app" : "o fallback volta pra página de convite avisando que não achou o app",
  fallbackUrl,
  APP_DOWNLOAD_URL || `${SITE_URL}?p=${CODE}&sem_app=1`,
);

// ---- convite pendente (com armazenamento falso na memória) ----
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

check("sem nada guardado", readPendingInvite(), null);
savePendingInvite(CODE, 1_000);
check("guarda e lê de volta", readPendingInvite(1_000 + 60_000), CODE);
check("ainda vale perto dos 7 dias", readPendingInvite(1_000 + 6 * 24 * 3600 * 1000), CODE);
check("vence depois de 7 dias (e é apagado)", [readPendingInvite(1_000 + 8 * 24 * 3600 * 1000), mem.size], [null, 0]);
savePendingInvite(CODE);
clearPendingInvite();
check("limpar apaga", readPendingInvite(), null);
mem.set("drivon.passenger.pendingInvite", "isto não é json");
check("lixo guardado não quebra (devolve null)", readPendingInvite(), null);
mem.set("drivon.passenger.pendingInvite", JSON.stringify({ code: "curto", savedAt: Date.now() }));
check("código inválido guardado é descartado", [readPendingInvite(), mem.size], [null, 0]);

(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: () => {
    throw new Error("bloqueado");
  },
  setItem: () => {
    throw new Error("bloqueado");
  },
  removeItem: () => {
    throw new Error("bloqueado");
  },
};
check("armazenamento bloqueado não quebra nada", [readPendingInvite(), (() => { savePendingInvite(CODE); clearPendingInvite(); return "ok"; })()], [null, "ok"]);

console.log(results.join("\n"));

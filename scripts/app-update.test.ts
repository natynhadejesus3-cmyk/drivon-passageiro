/**
 * Atualização do APK: decisão, validação do que vem da rede e o passo a passo (com plugin de mentira).
 * Rodar com: bun run scripts/app-update.test.ts
 */
import { createUpdateFlow, friendlyError, type NativeUpdater, type UpdatePhase } from "../src/lib/app-update/flow";
import { decideUpdate, formatSize, isTrustedApkUrl, isValidRelease, parseBuild, shouldShow, SNOOZE_MS, type ReleaseInfo } from "../src/lib/app-update/logic";

const results: string[] = [];
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? "PASS" : "FAIL"} — ${name}${ok ? "" : ` (esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)})`}`);
  if (!ok) process.exitCode = 1;
}

const REL: ReleaseInfo = {
  latestBuild: 4,
  latestVersion: "1.3",
  minBuild: 0,
  url: "https://github.com/dono/repo/releases/download/apps-1.3/drivon-motorista-1.3.apk",
  sha256: "a".repeat(64),
  sizeBytes: 5_800_000,
  notes: ["Atualização automática dentro do app."],
  publishedAt: "2026-10-15T12:00:00.000Z",
};

// ---- build instalado -------------------------------------------------------------------------
check("parseBuild: texto do Capacitor vira número", [parseBuild("4"), parseBuild(" 12 "), parseBuild(7)], [4, 12, 7]);
check("parseBuild: lixo vira null", [parseBuild(undefined), parseBuild(""), parseBuild("abc"), parseBuild("0"), parseBuild(-1), parseBuild(null)], [null, null, null, null, null, null]);

// ---- decisão ---------------------------------------------------------------------------------
check("já está na última versão: nada", decideUpdate(4, REL).kind, "none");
check("versão mais nova que a publicada (build de teste): nada", decideUpdate(9, REL).kind, "none");
check("versão antiga, sem obrigação: opcional", decideUpdate(2, REL).kind, "optional");
check("abaixo do mínimo: OBRIGATÓRIA", decideUpdate(2, { ...REL, minBuild: 3 }).kind, "mandatory");
check("exatamente no mínimo: só opcional", decideUpdate(3, { ...REL, minBuild: 3 }).kind, "optional");
check("não deu pra ler a versão: oferece (opcional), nunca obriga", decideUpdate(null, { ...REL, minBuild: 3 }).kind, "optional");
check("sem manifesto (rede caiu): nada", decideUpdate(2, null).kind, "none");

// ---- quando mostrar o aviso --------------------------------------------------------------------
const NOW = 1_000_000_000;
const opt = decideUpdate(2, REL);
const man = decideUpdate(2, { ...REL, minBuild: 3 });
check("opcional aparece", shouldShow(opt, null, NOW), true);
check("opcional some depois de 'Depois' (6 h)", [shouldShow(opt, NOW + SNOOZE_MS, NOW), shouldShow(opt, NOW + SNOOZE_MS, NOW + SNOOZE_MS - 1), shouldShow(opt, NOW + SNOOZE_MS, NOW + SNOOZE_MS)], [false, false, true]);
check("obrigatória ignora o 'Depois'", shouldShow(man, NOW + SNOOZE_MS, NOW), true);
check("sem atualização: nunca mostra", shouldShow({ kind: "none" }, null, NOW), false);

// ---- o que vem da rede é conferido -------------------------------------------------------------
check("manifesto bom é aceito", isValidRelease(REL), true);
const bad = (over: Record<string, unknown>) => isValidRelease({ ...REL, ...over });
check("recusa: sha256 curto, URL de outro site, http, sem .apk", [bad({ sha256: "abc" }), bad({ url: "https://evil.example/a.apk" }), bad({ url: "http://github.com/a.apk" }), bad({ url: "https://github.com/a/b/releases/x.zip" })], [false, false, false, false]);
check("recusa: build/mínimo sem sentido", [bad({ latestBuild: 0 }), bad({ minBuild: 5 }), bad({ minBuild: -1 }), bad({ latestBuild: 4.5 })], [false, false, false, false]);
check("recusa: tamanho, notas e data ruins", [bad({ sizeBytes: 0 }), bad({ notes: "texto" }), bad({ notes: new Array(9).fill("x") }), bad({ publishedAt: "ontem" })], [false, false, false, false]);
check("recusa: nulo, texto e objeto vazio", [isValidRelease(null), isValidRelease("x"), isValidRelease({})], [false, false, false]);
check("só aceita APK do github.com por https", [isTrustedApkUrl(REL.url), isTrustedApkUrl("https://github.com.evil.com/a.apk"), isTrustedApkUrl("https://githubusercontent.com/a.apk"), isTrustedApkUrl("não é url")], [true, false, false, false]);
check("tamanho legível", formatSize(5_767_168), "5,5 MB");

// ---- o passo a passo ----------------------------------------------------------------------------
function fakeUpdater(over: Partial<{ supported: boolean; canInstall: boolean; downloadFails: string; installFails: string }> = {}) {
  const calls: string[] = [];
  const updater: NativeUpdater = {
    status: async () => ({ supported: over.supported ?? true, canInstall: over.canInstall ?? true }),
    openInstallSettings: async () => { calls.push("settings"); },
    download: async (o, onProgress) => {
      calls.push(`download:${o.sha256.slice(0, 4)}`);
      if (over.downloadFails) throw new Error(over.downloadFails);
      onProgress(40);
      onProgress(100);
    },
    install: async () => {
      calls.push("install");
      if (over.installFails) throw new Error(over.installFails);
    },
  };
  return { updater, calls };
}
async function run(updater: NativeUpdater | null) {
  const phases: UpdatePhase[] = [];
  const opened: string[] = [];
  const flow = createUpdateFlow({ updater, openExternal: (u) => opened.push(u), setPhase: (p) => phases.push(p) });
  await flow.start(REL);
  return { phases, opened, flow };
}

{
  const f = fakeUpdater();
  const r = await run(f.updater);
  check("caminho feliz: baixa (0%, 40%, 100%), confere, abre o instalador", [r.phases.map((p) => (p.kind === "downloading" ? `d${p.percent}` : p.kind)), f.calls], [["d0", "d40", "d100", "installing"], ["download:aaaa", "install"]]);
}
{
  const f = fakeUpdater({ canInstall: false });
  const r = await run(f.updater);
  check("sem permissão do Android: pede a permissão e NÃO baixa", [r.phases.map((p) => p.kind), f.calls], [["needs-permission"], []]);
  await r.flow.openPermissionSettings();
  check("abre a tela de permissão do Android", f.calls, ["settings"]);
}
{
  const f = fakeUpdater({ supported: false });
  const r = await run(f.updater);
  check("app da Play Store: não oferece nada (quem atualiza é a Play)", [r.phases.map((p) => p.kind), f.calls], [["unsupported"], []]);
}
{
  const r = await run(null);
  check("APK ANTIGO (sem plugin): abre o link no navegador e orienta", [r.opened, r.phases.map((p) => p.kind)], [[REL.url], ["opened-browser"]]);
}
{
  const f = fakeUpdater({ downloadFails: "O arquivo baixado não confere (SHA-256). Tente de novo." });
  const r = await run(f.updater);
  const last = r.phases[r.phases.length - 1];
  check("arquivo adulterado/corrompido: erro claro e NÃO abre o instalador", [last?.kind, last?.kind === "error" ? last.message : "", f.calls.includes("install")], ["error", "O arquivo baixado não confere (SHA-256). Tente de novo.", false]);
}
{
  const f = fakeUpdater({ installFails: "Não foi possível abrir o instalador." });
  const r = await run(f.updater);
  check("falha ao abrir o instalador: erro claro", r.phases[r.phases.length - 1], { kind: "error", message: "Não foi possível abrir o instalador." });
}
check("erro estranho vira texto geral", [friendlyError(new Error("java.lang.NullPointerException")), friendlyError(undefined)], ["Não foi possível atualizar agora. Tente de novo.", "Não foi possível atualizar agora. Tente de novo."]);

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram`);

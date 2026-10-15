/**
 * Regras (sem React, sem rede) da ATUALIZAÇÃO DO APK. Este arquivo é igual nos dois apps (motorista e passageiro):
 * mexeu aqui, mexa no outro (src/lib/updates/update-logic.ts do motorista).
 *
 * Contexto: o site já atualiza sozinho (o APK só abre o site publicado). O que NÃO atualiza sozinho é a parte nativa
 * do APK (sons, permissões, o "casco"): pra isso o Android exige instalar um APK novo. O app avisa, baixa, confere
 * e abre o instalador; a pessoa só confirma "Instalar".
 */

export type AppId = "driver" | "passenger";

export type ReleaseInfo = {
  /** versionCode do APK mais novo. */
  latestBuild: number;
  /** Nome da versão pra mostrar: "1.3". */
  latestVersion: string;
  /** Quem está abaixo disso é OBRIGADO a atualizar (tela cheia, sem "Depois"). 0 = ninguém é obrigado. */
  minBuild: number;
  /** Endereço do APK (https, GitHub Releases). */
  url: string;
  /** Impressão digital (SHA-256) do APK: o app só instala se o arquivo baixado bater com ela. */
  sha256: string;
  sizeBytes: number;
  /** "O que há de novo", frases curtas. */
  notes: string[];
  publishedAt: string;
};

export type UpdateDecision =
  | { kind: "none" }
  | { kind: "optional"; release: ReleaseInfo }
  | { kind: "mandatory"; release: ReleaseInfo };

/** "Depois" esconde o aviso opcional por este tempo. */
export const SNOOZE_MS = 6 * 60 * 60_000;
/** Reconfere a cada tanto tempo enquanto o app fica aberto. */
export const RECHECK_MS = 6 * 60 * 60_000;

const SHA_RE = /^[0-9a-f]{64}$/i;

/** O build instalado, vindo do Capacitor como texto ("4"). null se não deu pra ler. */
export function parseBuild(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseInt(v, 10) : Number.NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Só se baixa APK por https, do github.com (as Releases), terminando em .apk. */
export function isTrustedApkUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.hostname === "github.com" && /\.apk$/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** Confere o formato do que o servidor mandou (nunca confiar cego numa resposta de rede). */
export function isValidRelease(x: unknown): x is ReleaseInfo {
  const r = x as Partial<ReleaseInfo> | null;
  if (!r || typeof r !== "object") return false;
  return (
    Number.isInteger(r.latestBuild) && (r.latestBuild as number) >= 1 &&
    Number.isInteger(r.minBuild) && (r.minBuild as number) >= 0 && (r.minBuild as number) <= (r.latestBuild as number) &&
    typeof r.latestVersion === "string" && r.latestVersion.length > 0 && r.latestVersion.length <= 20 &&
    typeof r.url === "string" && isTrustedApkUrl(r.url) &&
    typeof r.sha256 === "string" && SHA_RE.test(r.sha256) &&
    Number.isInteger(r.sizeBytes) && (r.sizeBytes as number) > 0 &&
    Array.isArray(r.notes) && r.notes.length <= 8 && r.notes.every((n) => typeof n === "string" && n.length <= 160) &&
    typeof r.publishedAt === "string" && !Number.isNaN(Date.parse(r.publishedAt))
  );
}

export function decideUpdate(currentBuild: number | null, release: ReleaseInfo | null): UpdateDecision {
  if (!release) return { kind: "none" };
  // Não deu pra ler a versão instalada (APK muito antigo): oferece, mas não obriga.
  if (currentBuild === null) return { kind: "optional", release };
  if (currentBuild >= release.latestBuild) return { kind: "none" };
  return currentBuild < release.minBuild ? { kind: "mandatory", release } : { kind: "optional", release };
}

/** Mostra o aviso agora? O obrigatório ignora o "Depois". */
export function shouldShow(decision: UpdateDecision, snoozedUntil: number | null, now: number): boolean {
  if (decision.kind === "none") return false;
  if (decision.kind === "mandatory") return true;
  return !(snoozedUntil !== null && now < snoozedUntil);
}

/** "5,5 MB" */
export function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

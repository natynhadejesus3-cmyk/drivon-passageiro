import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createUpdateFlow, type NativeUpdater, type UpdatePhase } from "./flow";
import { getNativeUpdater, openExternalUrl, waitForNative } from "./native-updater";
import {
  RECHECK_MS,
  SNOOZE_MS,
  decideUpdate,
  isValidRelease,
  parseBuild,
  shouldShow,
  type AppId,
  type ReleaseInfo,
  type UpdateDecision,
} from "./logic";

/** Igual nos dois apps (no motorista: src/hooks/use-app-update.ts). */

const snoozeKey = (app: AppId) => `drivon:update:snooze:${app}`;

function readSnooze(app: AppId): number | null {
  try {
    const n = Number(window.localStorage.getItem(snoozeKey(app)));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function installedBuild(): Promise<number | null> {
  try {
    const { App } = await import("@capacitor/app");
    return parseBuild((await App.getInfo()).build);
  } catch {
    return null;
  }
}

async function fetchRelease(app: AppId, manifestUrl: string): Promise<ReleaseInfo | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`${manifestUrl}?app=${app}`, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { ok?: boolean } & Partial<Record<AppId, unknown>>;
    return body.ok && isValidRelease(body[app]) ? (body[app] as ReleaseInfo) : null;
  } catch {
    return null; // sem internet agora: confere de novo depois
  } finally {
    clearTimeout(timer);
  }
}

/** undefined = ainda esperando a ponte nativa; native=false = navegador (nada a fazer). */
type Env = { native: boolean; updater: NativeUpdater | null };

/**
 * Atualização do APK: confere a versão publicada, decide se mostra o aviso e conduz a atualização.
 * Só age dentro do app instalado (no navegador não existe APK pra atualizar).
 */
export function useAppUpdate(app: AppId, manifestUrl: string) {
  const [env, setEnv] = useState<Env | undefined>(undefined);
  const [decision, setDecision] = useState<UpdateDecision>({ kind: "none" });
  const [phase, setPhase] = useState<UpdatePhase>({ kind: "idle" });
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(() => readSnooze(app));
  const [now, setNow] = useState(() => Date.now());
  const busy = useRef(false);

  // Espera a ponte nativa aparecer antes de decidir "APK novo" x "APK antigo" x "navegador".
  useEffect(() => {
    let cancelled = false;
    void waitForNative(4000).then((native) => {
      if (!cancelled) setEnv({ native, updater: native ? getNativeUpdater() : null });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updater = env?.updater ?? null;
  const flow = useMemo(() => createUpdateFlow({ updater, openExternal: openExternalUrl, setPhase }), [updater]);
  const release = decision.kind === "none" ? null : decision.release;

  const check = useCallback(async () => {
    if (!env?.native || busy.current) return;
    busy.current = true;
    try {
      // App da Play Store: quem atualiza é a Play, não oferece nada.
      if (env.updater) {
        const st = await env.updater.status().catch(() => null);
        if (st && !st.supported) {
          setDecision({ kind: "none" });
          return;
        }
      }
      const [build, rel] = await Promise.all([installedBuild(), fetchRelease(app, manifestUrl)]);
      setDecision(decideUpdate(build, rel));
    } finally {
      busy.current = false;
    }
  }, [app, manifestUrl, env]);

  // Confere ao abrir e de tempos em tempos.
  useEffect(() => {
    void check();
    const id = setInterval(() => void check(), RECHECK_MS);
    return () => clearInterval(id);
  }, [check]);

  // Voltou pro app (ex.: voltou da tela de permissão do Android, ou o "Depois" venceu): retoma/reconfere.
  const phaseKind = phase.kind;
  useEffect(() => {
    if (!env?.native) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    void import("@capacitor/app")
      .then(async ({ App }) => {
        const handle = await App.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) return;
          setNow(Date.now());
          if (phaseKind === "needs-permission" && release) void flow.start(release);
          else if (phaseKind !== "downloading") void check();
        });
        if (cancelled) void handle.remove();
        else remove = () => void handle.remove();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      remove?.();
    };
  }, [env, phaseKind, release, flow, check]);

  // O "Depois" vence sozinho sem precisar de um toque.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const dismiss = useCallback(() => {
    const until = Date.now() + SNOOZE_MS;
    setSnoozedUntil(until);
    try {
      window.localStorage.setItem(snoozeKey(app), String(until));
    } catch {
      /* sem armazenamento: o aviso volta na próxima abertura */
    }
  }, [app]);

  return {
    decision,
    release,
    phase,
    visible: !!env?.native && shouldShow(decision, snoozedUntil, now),
    mandatory: decision.kind === "mandatory",
    start: () => (release ? flow.start(release) : Promise.resolve()),
    openPermissionSettings: () => flow.openPermissionSettings(),
    dismiss,
    /** Só há o plugin nativo em APK novo; em APK antigo a atualização é pelo navegador. */
    hasInAppInstaller: updater !== null,
  };
}

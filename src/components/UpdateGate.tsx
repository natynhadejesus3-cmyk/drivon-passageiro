import { useState } from "react";
import { useAppUpdate } from "@/lib/app-update/use-app-update";
import { formatSize, type AppId } from "@/lib/app-update/logic";

/**
 * Aviso de "Nova versão" do APK. Igual nos dois apps (no motorista: src/components/UpdateGate.tsx).
 *
 * Opcional: um cartãozinho no topo ("Atualizar" / "Depois"). Obrigatório (versão abaixo do mínimo): tela cheia,
 * sem "Depois". O Android SEMPRE pede a confirmação final ("Instalar") -- nenhum app instala escondido.
 * Fica fora do AppShell de propósito (o <main> dele tem transform, que prende o "fixed").
 */
export function UpdateGate({ app, manifestUrl, appName }: { app: AppId; manifestUrl: string; appName: string }) {
  const u = useAppUpdate(app, manifestUrl);
  const [showNotes, setShowNotes] = useState(false);

  if (!u.visible || !u.release || u.phase.kind === "unsupported") return null;
  const { release, phase } = u;

  const body = (
    <>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            {u.mandatory ? `Atualize o ${appName} para continuar` : `Nova versão do ${appName}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Versão {release.latestVersion} · {formatSize(release.sizeBytes)}
          </p>
        </div>
        {!u.mandatory && phase.kind === "idle" && (
          <button type="button" onClick={u.dismiss} className="shrink-0 px-1 py-1 text-xs font-semibold text-muted-foreground">
            Depois
          </button>
        )}
      </div>

      {release.notes.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            aria-expanded={showNotes}
            className="text-xs font-semibold text-primary"
          >
            {showNotes ? "Esconder novidades" : "Ver novidades"}
          </button>
          {showNotes && (
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {release.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-3">
        {phase.kind === "idle" && (
          <button type="button" onClick={() => void u.start()} className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
            Atualizar agora
          </button>
        )}

        {phase.kind === "needs-permission" && (
          <>
            <p className="text-xs text-muted-foreground">
              O Android precisa da sua permissão para instalar a atualização. Toque em <b>Permitir</b>, ative a opção e volte para cá.
            </p>
            <button type="button" onClick={() => void u.openPermissionSettings()} className="mt-2 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
              Permitir
            </button>
          </>
        )}

        {phase.kind === "downloading" && (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-[color:var(--color-hairline)]">
              <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${phase.percent}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Baixando… {phase.percent}%</p>
          </>
        )}

        {phase.kind === "installing" && (
          <>
            <p className="text-xs text-muted-foreground">
              Abrindo o instalador do Android. Toque em <b>Instalar</b> para terminar.
            </p>
            <button type="button" onClick={() => void u.start()} className="mt-2 w-full rounded-xl border border-[color:var(--color-hairline)] px-4 py-2.5 text-sm font-bold">
              Abrir o instalador de novo
            </button>
          </>
        )}

        {phase.kind === "opened-browser" && (
          <>
            <p className="text-xs text-muted-foreground">
              O download começou no navegador do celular. Quando terminar, toque no arquivo baixado e em <b>Instalar</b>. Se o Android perguntar,
              permita instalar desta fonte. Se aparecer “App não instalado”, desinstale o {appName} e instale de novo.
            </p>
            <button type="button" onClick={() => void u.start()} className="mt-2 w-full rounded-xl border border-[color:var(--color-hairline)] px-4 py-2.5 text-sm font-bold">
              Baixar de novo
            </button>
          </>
        )}

        {phase.kind === "error" && (
          <>
            <p role="alert" className="text-xs font-semibold text-destructive">
              {phase.message}
            </p>
            <button type="button" onClick={() => void u.start()} className="mt-2 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
              Tentar de novo
            </button>
          </>
        )}
      </div>
    </>
  );

  if (u.mandatory) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background px-6" role="dialog" aria-modal="true">
        <div className="w-full max-w-sm rounded-2xl border border-[color:var(--color-hairline)] bg-card p-5">{body}</div>
      </div>
    );
  }

  return (
    <div
      className="fixed left-3 right-3 z-[90] mx-auto max-w-[456px] rounded-2xl border border-[color:var(--color-hairline)] bg-card p-3.5 shadow-lg"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
      role="status"
    >
      {body}
    </div>
  );
}

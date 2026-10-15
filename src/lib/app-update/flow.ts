import type { ReleaseInfo } from "./logic";

/**
 * O passo a passo da atualização (sem React, com tudo que é "de fora" injetado: dá pra testar sem celular).
 * Igual nos dois apps (no motorista: src/lib/updates/update-flow.ts).
 *
 * Dois caminhos:
 *  - APK COM atualizador (1.3 em diante): permissão -> baixa dentro do app, conferindo o SHA-256 -> abre o instalador.
 *  - APK ANTIGO (sem o plugin): abre o link do APK no navegador do celular; a pessoa toca no arquivo baixado.
 */

export type UpdatePhase =
  | { kind: "idle" }
  /** O Android ainda não liberou "instalar apps desta fonte" pro Drivon. */
  | { kind: "needs-permission" }
  | { kind: "downloading"; percent: number }
  /** O instalador do Android foi aberto: falta só a pessoa tocar em Instalar. */
  | { kind: "installing" }
  /** APK antigo: o download foi entregue ao navegador do celular. */
  | { kind: "opened-browser" }
  /** App da Play Store: quem atualiza é a Play. */
  | { kind: "unsupported" }
  | { kind: "error"; message: string };

/** O plugin nativo (ApkUpdater), do jeito que o fluxo o usa. */
export type NativeUpdater = {
  status(): Promise<{ supported: boolean; canInstall: boolean }>;
  openInstallSettings(): Promise<void>;
  download(o: { url: string; sha256: string }, onProgress: (percent: number) => void): Promise<void>;
  install(): Promise<void>;
};

export type FlowDeps = {
  /** null = APK antigo, sem o plugin. */
  updater: NativeUpdater | null;
  openExternal(url: string): void;
  setPhase(p: UpdatePhase): void;
};

const GENERIC_ERROR = "Não foi possível atualizar agora. Tente de novo.";

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : (e as { message?: unknown } | null)?.message;
  // As mensagens do plugin nativo já vêm em português; qualquer outra vira o texto geral.
  return typeof msg === "string" && /[áéíóúãõç]|atualiza|baixa|instala|confere/i.test(msg) && msg.length < 160 ? msg : GENERIC_ERROR;
}

export function createUpdateFlow(deps: FlowDeps) {
  return {
    /** Começa (ou retoma) a atualização. */
    async start(release: ReleaseInfo): Promise<void> {
      if (!deps.updater) {
        deps.openExternal(release.url);
        deps.setPhase({ kind: "opened-browser" });
        return;
      }
      try {
        const st = await deps.updater.status();
        if (!st.supported) {
          deps.setPhase({ kind: "unsupported" });
          return;
        }
        if (!st.canInstall) {
          deps.setPhase({ kind: "needs-permission" });
          return;
        }
        deps.setPhase({ kind: "downloading", percent: 0 });
        await deps.updater.download({ url: release.url, sha256: release.sha256 }, (percent) =>
          deps.setPhase({ kind: "downloading", percent }),
        );
        await deps.updater.install();
        deps.setPhase({ kind: "installing" });
      } catch (e) {
        deps.setPhase({ kind: "error", message: friendlyError(e) });
      }
    },

    /** Abre a tela do Android onde se libera a instalação. Ao voltar pro app, chame start() de novo. */
    async openPermissionSettings(): Promise<void> {
      try {
        await deps.updater?.openInstallSettings();
      } catch (e) {
        deps.setPhase({ kind: "error", message: friendlyError(e) });
      }
    },
  };
}

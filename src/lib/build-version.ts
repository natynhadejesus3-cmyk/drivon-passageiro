// O GitHub Pages manda guardar a página por até 10 minutos (Cache-Control:
// max-age=600), e o APK abre o site publicado dentro de um WebView: sem isso,
// depois de cada atualização o celular podia continuar rodando a versão antiga
// por um bom tempo. Aqui o app confere, ao abrir e ao voltar pra ele, se já
// existe uma versão mais nova publicada e recarrega sozinho.
const ENTRY_RE = /assets\/index-([A-Za-z0-9_-]+)\.js/;

/** Identificador do build que está rodando agora (hash do arquivo de entrada); null no modo dev. */
export function runningBuildId(): string | null {
  if (typeof document === "undefined") return null;
  const src = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.src ?? "";
  return src.match(ENTRY_RE)?.[1] ?? null;
}

/** Hash do build publicado neste momento (busca a página sem usar o cache). */
async function publishedBuildId(): Promise<string | null> {
  const res = await fetch(import.meta.env.BASE_URL, { cache: "reload" });
  const html = await res.text();
  return html.match(ENTRY_RE)?.[1] ?? null;
}

const RELOADED_KEY = "drivon:reloaded-for-build";

export function startVersionWatcher(): () => void {
  const running = runningBuildId();
  if (!running) return () => {}; // modo dev: não há build publicado pra comparar

  let busy = false;
  const check = async () => {
    if (busy) return;
    busy = true;
    try {
      const published = await publishedBuildId();
      if (!published || published === running) return;
      // Anti-loop: se mesmo depois de recarregar ainda vier a página velha
      // (cache insistente), não fica recarregando sem parar.
      if (sessionStorage.getItem(RELOADED_KEY) === published) return;
      sessionStorage.setItem(RELOADED_KEY, published);
      window.location.reload();
    } catch {
      /* sem internet: tenta de novo na próxima vez */
    } finally {
      busy = false;
    }
  };

  void check();
  const onVisible = () => document.visibilityState === "visible" && void check();
  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}

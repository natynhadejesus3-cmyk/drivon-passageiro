import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { parseRecoveryToken } from "@/lib/recovery";

const LAST_KEY = "drivon.passenger.lastRecoveryToken";

/** O Android pode reentregar o link que abriu o app (ex.: voltando pelos apps recentes). Cada token vale uma vez só. */
function alreadyHandled(token: string): boolean {
  try {
    return localStorage.getItem(LAST_KEY) === token;
  } catch {
    return false;
  }
}

function remember(token: string) {
  try {
    localStorage.setItem(LAST_KEY, token);
  } catch {
    /* ignora */
  }
}

/**
 * Dentro do app instalado: quando o Android entrega o link de "esqueci minha senha" (a pessoa tocou
 * "Abrir no aplicativo" na página do e-mail: drivonpassageiro://p/recuperar?token_hash=...), avisa
 * o App pra conferir o token e mostrar a tela "Nova senha". Mesma ideia do native-invite.ts.
 * Devolve a função que desliga a escuta.
 */
export function listenForRecoveryLinks(onToken: (tokenHash: string) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  let cancelled = false;
  let remove: (() => Promise<void>) | undefined;

  const take = (url: string | undefined | null) => {
    const token = parseRecoveryToken(url);
    if (!token || alreadyHandled(token)) return;
    remember(token);
    onToken(token);
  };

  try {
    App.getLaunchUrl()
      .then((r) => !cancelled && take(r?.url))
      .catch(() => {});
    App.addListener("appUrlOpen", (e) => take(e.url))
      .then((handle) => {
        if (cancelled) void handle.remove();
        else remove = () => handle.remove();
      })
      .catch(() => {});
  } catch {
    /* APK antigo, sem o plugin: segue sem deep link */
  }

  return () => {
    cancelled = true;
    void remove?.();
  };
}

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Car, Download, Smartphone } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { errorMessage } from "@/lib/error-messages";
import { APP_DOWNLOAD_URL } from "@/lib/invite";
import { buildOpenRecoveryAppUrl, clearRecoveryParamsFromUrl } from "@/lib/recovery";
import { verifyRecoveryToken } from "@/lib/recovery-actions";

const isAndroid = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

/**
 * Tela do botão "Criar nova senha" do e-mail de "esqueci minha senha".
 *
 *  - No navegador: "Abrir no aplicativo" (Android) ou "Continuar no navegador". Só confere o
 *    link quando a pessoa toca -- assim programas que "abrem" os links do e-mail pra checar
 *    vírus não gastam o link antes dela.
 *  - Dentro do app instalado: confere na hora e mostra a tela "Nova senha".
 *
 * Quando o link é conferido, `startRecovery` abre a sessão e o App troca esta tela por "Nova senha".
 */
export function RecoveryLink({
  tokenHash,
  noApp,
  onBack,
  onDone,
}: {
  tokenHash: string;
  noApp: boolean;
  onBack: () => void;
  onDone: () => void;
}) {
  const { startRecovery } = useAuth();
  const native = Capacitor.isNativePlatform();
  const android = isAndroid();
  const [state, setState] = useState<"landing" | "checking" | "error">(native ? "checking" : "landing");
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setState("checking");
    setError(null);
    try {
      const session = await verifyRecoveryToken(tokenHash);
      clearRecoveryParamsFromUrl();
      startRecovery(session);
      onDone();
    } catch (err) {
      clearRecoveryParamsFromUrl();
      setError(errorMessage(err));
      setState("error");
    }
  }

  // Dentro do app não tem o que escolher: já confere.
  useEffect(() => {
    if (native) void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "checking") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <div className="grid h-16 w-16 animate-pulse place-items-center rounded-3xl bg-primary-soft text-primary">
          <Car size={28} />
        </div>
        <h1 className="text-title">Conferindo seu link...</h1>
        <p className="text-subtitle">É rapidinho.</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex h-full flex-col justify-center px-6 py-10">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary-soft text-primary">
            <Car size={28} />
          </div>
          <h1 className="text-title">Não deu certo</h1>
          <p className="text-subtitle">{error}</p>
        </div>
        <button type="button" onClick={onBack} className="btn-primary flex w-full items-center justify-center">
          Voltar para entrar
        </button>
      </div>
    );
  }

  const showOpenApp = android && !noApp;
  return (
    <div className="flex h-full flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary-soft text-primary">
          <Car size={28} />
        </div>
        <h1 className="text-title">Criar nova senha</h1>
        <p className="text-subtitle">
          Você pediu para trocar a senha do Drivon Passageiro. {showOpenApp ? "Toque abaixo para continuar no aplicativo." : "Toque abaixo para continuar."}
        </p>
      </div>

      <div className="card-elevated space-y-3 p-5">
        {noApp && (
          <p className="text-label text-warning">
            Não achamos o aplicativo neste celular. Baixe abaixo ou continue pelo navegador.
          </p>
        )}

        {showOpenApp && (
          <a href={buildOpenRecoveryAppUrl(tokenHash)} className="btn-primary flex w-full items-center justify-center gap-2">
            <Smartphone size={17} />
            Abrir no aplicativo
          </a>
        )}

        {noApp && APP_DOWNLOAD_URL && (
          <a href={APP_DOWNLOAD_URL} className="btn-primary flex w-full items-center justify-center gap-2">
            <Download size={17} />
            Baixar o aplicativo
          </a>
        )}

        <button
          type="button"
          onClick={() => void check()}
          className={`${showOpenApp || (noApp && APP_DOWNLOAD_URL) ? "btn-outline-neutral" : "btn-primary"} flex w-full items-center justify-center`}
        >
          Continuar no navegador
        </button>
      </div>

      <p className="mt-4 px-2 text-center text-label opacity-70">
        Não foi você que pediu? É só ignorar o e-mail: sua senha continua a mesma.
      </p>
    </div>
  );
}

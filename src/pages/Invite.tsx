import { useEffect } from "react";
import { Car, Download, Smartphone, UserCheck } from "lucide-react";
import { recordInviteClick } from "@/lib/handoff";
import { useInviteDriverName } from "@/lib/use-invite";
import { APP_DOWNLOAD_URL, buildOpenAppUrl } from "@/lib/invite";

const isAndroid = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

/**
 * Página que a CÂMERA do celular abre ao ler o QR do motorista. Só aparece no navegador
 * (dentro do app instalado o convite é tratado direto, sem esta tela).
 *
 *  - Quem tem o app: "Abrir no app".
 *  - Quem não tem: "Baixar o app" (quando APP_DOWNLOAD_URL estiver preenchido) ou seguir
 *    pelo navegador mesmo -- o motorista já fica salvo na conta, então ao baixar o app
 *    depois e entrar com o mesmo e-mail ele já está lá.
 */
export function Invite({ code, noApp, onContinue }: { code: string; noApp: boolean; onContinue: () => void }) {
  const name = useInviteDriverName(code);
  const android = isAndroid();

  // Deixa um recado no banco ("alguém nesta rede abriu o convite X") pra que o app, depois de
  // instalado, saiba de qual motorista a pessoa veio (ver lib/handoff.ts). Só faz sentido no Android.
  useEffect(() => {
    if (android) void recordInviteClick(code);
  }, [code, android]);

  return (
    <div className="flex h-full flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary-soft text-primary">
          <Car size={28} />
        </div>
        <h1 className="text-title">{name ? `${name} te convidou` : "Você recebeu um convite"}</h1>
        <p className="text-subtitle">
          {name
            ? `Entre no Drivon Passageiro e ${name} já aparece na sua lista, pronto pra conversar e combinar corridas.`
            : "Entre no Drivon Passageiro e o motorista já aparece na sua lista, pronto pra conversar e combinar corridas."}
        </p>
      </div>

      <div className="card-elevated space-y-3 p-5">
        {name && (
          <div className="flex items-center gap-3 rounded-xl border border-[color:var(--color-hairline)] px-3.5 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <UserCheck size={17} />
            </span>
            <div className="min-w-0 text-left">
              <p className="truncate text-body font-semibold">{name}</p>
              <p className="text-label">Motorista Drivon · convite pronto</p>
            </div>
          </div>
        )}

        {noApp && (
          <p className="text-label text-warning">
            Não achamos o app neste celular. Baixe abaixo ou continue pelo navegador.
          </p>
        )}

        {android && !noApp && (
          <a href={buildOpenAppUrl(code)} className="btn-primary flex w-full items-center justify-center gap-2">
            <Smartphone size={17} />
            Abrir no app
          </a>
        )}

        {APP_DOWNLOAD_URL && (
          <a
            href={APP_DOWNLOAD_URL}
            className={`${android && !noApp ? "btn-outline" : "btn-primary"} flex w-full items-center justify-center gap-2`}
          >
            <Download size={17} />
            Baixar o app
          </a>
        )}

        <button
          type="button"
          onClick={onContinue}
          className={`${android || APP_DOWNLOAD_URL ? "btn-outline-neutral" : "btn-primary"} flex w-full items-center justify-center`}
        >
          {android || APP_DOWNLOAD_URL ? "Continuar pelo navegador" : "Continuar"}
        </button>
      </div>

      <p className="mt-4 text-center text-label">
        Depois de instalar, abra o app e entre na sua conta: o motorista já aparece. Se não aparecer, entre com o mesmo e-mail que usou aqui.
      </p>
    </div>
  );
}

/** Faixa de aviso no topo do login quando há um convite esperando ("Fulano te convidou"). */
export function InviteBanner({ code }: { code: string }) {
  const name = useInviteDriverName(code);
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[color:var(--color-hairline)] bg-primary-soft px-4 py-3 text-left">
      <UserCheck size={18} className="shrink-0 text-primary" />
      <p className="text-label text-foreground">
        {name ? `${name} te convidou.` : "Você recebeu um convite de um motorista."} Entre ou crie sua conta e ele já aparece na sua lista.
      </p>
    </div>
  );
}

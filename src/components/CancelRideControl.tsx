import { useState } from "react";
import { requestRideCancellation } from "@/lib/cancel-ride";

/**
 * Botão "Cancelar" de um pedido/corrida, com confirmação antes (cancelar sem querer deixa o motorista
 * esperando à toa). O motorista recebe um aviso assim que o cancelamento é feito.
 */
export function CancelRideControl({
  messageId,
  kind,
  driverName,
  onDone,
}: {
  messageId: string;
  /** "request" = pedido ainda sem resposta; "ride" = corrida que o motorista já aceitou. */
  kind: "request" | "ride";
  driverName: string;
  onDone: () => void;
}) {
  const [step, setStep] = useState<"idle" | "confirm" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const what = kind === "ride" ? "corrida" : "pedido";

  async function cancel() {
    setStep("sending");
    setError(null);
    const res = await requestRideCancellation(messageId);
    if (res.ok) {
      setStep("idle");
      onDone();
      return;
    }
    setError(res.error);
    setStep("idle");
  }

  if (step === "idle") {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep("confirm");
          }}
          className="w-full rounded-xl border border-destructive/40 px-3 py-2 text-xs font-bold text-destructive"
        >
          {kind === "ride" ? "Cancelar corrida" : "Cancelar pedido"}
        </button>
        {error && <p className="mt-2 text-[11px] font-semibold text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-destructive/40 p-3">
      <p className="text-[12px] font-semibold text-foreground">
        Cancelar {kind === "ride" ? "esta corrida" : "este pedido"}? {driverName ? `${driverName} ` : "O motorista "}será avisado.
      </p>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={step === "sending"}
          onClick={() => setStep("idle")}
          className="rounded-xl border border-[color:var(--color-hairline)] px-3 py-2 text-xs font-bold text-muted-foreground disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          type="button"
          disabled={step === "sending"}
          onClick={cancel}
          aria-label={`Sim, cancelar ${what}`}
          className="rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {step === "sending" ? "Cancelando…" : "Sim, cancelar"}
        </button>
      </div>
    </div>
  );
}

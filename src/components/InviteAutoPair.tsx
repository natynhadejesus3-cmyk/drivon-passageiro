import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { errorMessage } from "@/lib/error-messages";
import { clearPendingInvite, readPendingInvite } from "@/lib/invite";
import { pairWithDriver } from "@/lib/repository";

type Status = { phase: "pairing" } | { phase: "error"; code: string; message: string; canRetry: boolean };

/**
 * Quem entrou com um convite pendente (QR lido pela câmera) é pareado sozinho assim que
 * há conta logada, e cai direto na conversa com o motorista. Fica de fora do fluxo normal:
 * sem convite pendente não renderiza nada.
 *
 * `tick` muda quando chega um convite novo com o app já aberto (link tocado por fora).
 */
export function InviteAutoPair({ tick }: { tick: number }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const running = useRef<string | null>(null);

  const run = useCallback(
    async (code: string) => {
      // O React em desenvolvimento roda o efeito duas vezes; sem esta trava pareava em dobro.
      if (running.current === code) return;
      running.current = code;
      setStatus({ phase: "pairing" });
      try {
        const displayName = (user?.user_metadata?.display_name as string | undefined) || undefined;
        const result = await pairWithDriver(code, displayName);
        clearPendingInvite();
        setStatus(null);
        navigate(`/chat/${result.link_id}`, { replace: true });
      } catch (err) {
        // O erro do Supabase pode ser objeto simples (não `Error`), então lê `message` e `code` direto.
        const msg = String((err as { message?: unknown } | null)?.message ?? "");
        const invalid = /invalid pairing code/i.test(msg) || (err as { code?: string } | null)?.code === "P0002";
        // Código que não existe nunca vai funcionar: descarta. Outros erros (sem rede...) mantêm o convite.
        if (invalid) clearPendingInvite();
        setStatus({
          phase: "error",
          code,
          canRetry: !invalid,
          message: invalid
            ? "Esse convite não é mais válido. Peça pro motorista mostrar o QR Code dele de novo."
            : errorMessage(err, "Não foi possível conectar com o motorista agora."),
        });
      } finally {
        running.current = null;
      }
    },
    [navigate, user?.user_metadata?.display_name],
  );

  useEffect(() => {
    if (!user?.id) return;
    const code = readPendingInvite();
    if (code) void run(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tick]);

  if (!status) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 px-8 backdrop-blur-sm">
      <div className="card-elevated w-full max-w-sm space-y-4 p-6 text-center">
        {status.phase === "pairing" ? (
          <p className="text-body font-semibold">Conectando com o motorista…</p>
        ) : (
          <>
            <p className="text-label text-destructive">{status.message}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStatus(null)} className="btn-outline-neutral flex-1">
                Fechar
              </button>
              {status.canRetry && (
                <button type="button" onClick={() => void run(status.code)} className="btn-primary flex-1">
                  Tentar de novo
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

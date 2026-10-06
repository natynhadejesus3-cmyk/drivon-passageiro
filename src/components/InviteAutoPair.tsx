import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { errorMessage } from "@/lib/error-messages";
import { claimInviteHandoff, handoffAlreadyChecked, markHandoffChecked } from "@/lib/handoff";
import { clearPendingInvite, readPendingInvite } from "@/lib/invite";
import { pairWithDriver } from "@/lib/repository";

type Status =
  | { phase: "pairing" }
  | { phase: "confirm"; code: string; name: string }
  | { phase: "error"; code: string; message: string; canRetry: boolean };

/**
 * Quem entrou com um convite pendente (QR lido pela câmera) é pareado sozinho assim que
 * há conta logada, e cai direto na conversa com o motorista. Fica de fora do fluxo normal:
 * sem convite pendente não renderiza nada.
 *
 * App recém-instalado (sem convite em mãos): pergunta ao banco se um convite foi aberto
 * neste celular há pouco (lib/handoff.ts) e, se sim, confirma com a pessoa antes de parear.
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

  // App instalado agora há pouco: o convite que a pessoa viu no navegador não veio junto,
  // então pergunta ao banco. O claim APAGA o registro no servidor, por isso só uma pergunta
  // por conta/instalação, e a trava `claiming` impede a segunda rodada do efeito (React em
  // desenvolvimento roda duas vezes) de gastar o convite sem ninguém ver.
  const claiming = useRef<string | null>(null);
  useEffect(() => {
    const id = user?.id;
    if (!id || !Capacitor.isNativePlatform()) return;
    if (readPendingInvite() || handoffAlreadyChecked(id) || claiming.current === id) return;
    claiming.current = id;
    void claimInviteHandoff().then(({ ok, handoff }) => {
      if (!ok) {
        claiming.current = null; // a pergunta não chegou: tenta de novo no próximo login/abertura
        return;
      }
      markHandoffChecked(id);
      if (handoff) setStatus({ phase: "confirm", code: handoff.code, name: handoff.firstName });
    });
  }, [user?.id, tick]);

  if (!status) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 px-8 backdrop-blur-sm">
      <div className="card-elevated w-full max-w-sm space-y-4 p-6 text-center">
        {status.phase === "pairing" ? (
          <p className="text-body font-semibold">Conectando com o motorista…</p>
        ) : status.phase === "confirm" ? (
          <>
            <p className="text-body font-semibold">Você veio pelo convite de {status.name}?</p>
            <p className="text-label">Um convite dele foi aberto neste celular agora há pouco. Se for você, é só confirmar.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStatus(null)} className="btn-outline-neutral flex-1">
                Agora não
              </button>
              <button type="button" onClick={() => void run(status.code)} className="btn-primary flex-1">
                Sim, parear
              </button>
            </div>
          </>
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

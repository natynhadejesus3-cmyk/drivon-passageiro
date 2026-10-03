import { CalendarCheck, Check, Flag, MapPin } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Confetti } from "./Confetti";
import { DriverAvatar } from "./DriverAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getConfirmedRides, getDriverPublicProfile, getLinks } from "@/lib/repository";

export type Accepted = {
  id: string;
  linkId: string;
  driverName: string;
  avatarUrl: string | null;
  when: string;
  origin: string | null;
  destination: string | null;
};

const seenKey = (userId: string) => `drivon:ride-accepted-seen:v1:${userId}`;
// Na primeira checagem, só pedidos mais antigos que isso contam como histórico.
const FRESH_WINDOW_MS = 15 * 60_000;

function loadSeen(userId: string): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(seenKey(userId));
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function saveSeen(userId: string, seen: Set<string>) {
  try {
    window.localStorage.setItem(seenKey(userId), JSON.stringify([...seen]));
  } catch {
    /* ignore */
  }
}

function whenLabel(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  // Só a primeira letra maiúscula ("Sexta-feira", não "Sexta-Feira").
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
}

/**
 * Aviso DENTRO do app quando o motorista aceita um pedido de corrida: tela
 * de "Corrida aceita!" com confete, em qualquer tela em que o passageiro
 * estiver (não só na conversa). Sem push -- é só o app aberto reagindo.
 *
 * Como sabe o que é novo: guarda no aparelho os pedidos aceitos que já foram
 * mostrados. Na primeira vez, tudo que já está aceito conta como "visto" (não
 * comemora histórico antigo); depois, qualquer aceite novo comemora -- inclusive
 * um que aconteceu enquanto o app estava fechado, na hora em que ele abre.
 */
export function RideAcceptedCelebration() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id;
  const [queue, setQueue] = useState<Accepted[]>([]);
  const checkingRef = useRef(false);
  const rerunRef = useRef(false);

  const check = useCallback(async () => {
    if (!userId) return;
    // Chegou outro aviso com uma checagem ainda em andamento: não perde, roda de novo no fim.
    if (checkingRef.current) {
      rerunRef.current = true;
      return;
    }
    checkingRef.current = true;
    try {
      const rides = await getConfirmedRides();
      let seen = loadSeen(userId);
      if (!seen) {
        // Primeira vez neste aparelho: o histórico antigo não comemora, mas um
        // aceite de poucos minutos atrás sim (senão quem acabou de atualizar o
        // app e testa logo em seguida nunca veria o aviso).
        const cutoff = Date.now() - FRESH_WINDOW_MS;
        seen = new Set(rides.filter((r) => new Date(r.created_at).getTime() < cutoff).map((r) => r.id));
        saveSeen(userId, seen);
      }
      const fresh = rides.filter((r) => !seen.has(r.id));
      if (fresh.length === 0) return;

      // Marca já, antes de montar o aviso: nada comemora duas vezes.
      fresh.forEach((r) => seen.add(r.id));
      saveSeen(userId, seen);

      const links = await getLinks().catch(() => []);
      const driverByLink = new Map(links.map((l) => [l.id, l.driver_id]));
      const items: Accepted[] = await Promise.all(
        // mais antigo primeiro, pra mostrar na ordem em que foram aceitos
        [...fresh].reverse().map(async (r) => {
          const driverId = driverByLink.get(r.link_id);
          const profile = driverId ? await getDriverPublicProfile(driverId).catch(() => null) : null;
          return {
            id: r.id,
            linkId: r.link_id,
            driverName: profile?.full_name || "Seu motorista",
            avatarUrl: profile?.avatar_url ?? null,
            when: r.requested_at ?? r.created_at,
            origin: r.origin_label,
            destination: r.destination_label,
          };
        }),
      );
      setQueue((q) => [...q, ...items]);
      try {
        navigator.vibrate?.([90, 50, 90]);
      } catch {
        /* ignore */
      }
    } catch (e) {
      console.error("[drivon] ride-accepted check failed", e);
    } finally {
      checkingRef.current = false;
      if (rerunRef.current) {
        rerunRef.current = false;
        void check();
      }
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void check();

    // Tempo real: o motorista aceitar atualiza a mensagem do pedido (RLS já
    // entrega só as conversas deste passageiro). Polling e "voltou pro app"
    // cobrem queda de conexão do tempo real.
    const channel = supabase
      .channel(`ride-accepted:${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages" }, () => void check())
      .subscribe();
    const poll = setInterval(() => void check(), 15_000);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [userId, check]);

  const current = queue[0];
  if (!current) return null;

  const dismiss = () => setQueue((q) => q.slice(1));

  return (
    <AcceptedModal
      item={current}
      more={queue.length - 1}
      onClose={dismiss}
      onSeeAgenda={() => {
        dismiss();
        navigate("/agenda");
      }}
    />
  );
}

/** Uma linha do cartão: ícone fixo à esquerda e texto que quebra em várias linhas. */
function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 line-clamp-3 break-words text-[14px] font-medium leading-snug">{children}</p>
      </div>
    </div>
  );
}

/** Parte visual do aviso (separada da lógica pra poder ser vista/testada sozinha). */
export function AcceptedModal({
  item: current,
  more,
  onClose,
  onSeeAgenda,
}: {
  item: Accepted;
  more: number;
  onClose: () => void;
  onSeeAgenda: () => void;
}) {
  // Portal no <body>: telas dentro do <main> (animação com transform) prendem
  // elementos "fixed" nele -- o aviso precisa cobrir a tela inteira sempre.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Corrida aceita"
      className="fixed inset-0 z-[200] grid place-items-center bg-black/70 px-6"
      style={{ animation: "fade-in 0.25s ease-out" }}
    >
      <Confetti key={current.id} />

      {/* Nunca passa da altura da tela (celular baixo / teclado) -- se faltar
          espaço, o cartão rola em vez de cortar o botão de baixo. */}
      <div
        key={current.id}
        className="card-elevated relative z-[205] max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto px-5 pb-5 pt-7 text-center"
        style={{ animation: "pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
      >
        <div className="mx-auto grid h-[72px] w-[72px] place-items-center rounded-full bg-success/15">
          <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-success text-white shadow-[0_8px_30px_-6px_rgba(34,197,94,0.7)]">
            <Check size={30} strokeWidth={3.2} />
          </div>
        </div>

        <h2 className="mt-4 text-2xl font-black leading-tight tracking-tight">Corrida aceita! 🎉</h2>
        <p className="mt-1 text-body text-muted-foreground">
          <span className="font-semibold text-foreground">{current.driverName}</span> confirmou o seu pedido.
        </p>

        {/* Os endereços quebram em mais de uma linha (nada de "…" cortando
            o endereço): cada dado em uma linha própria, com o mesmo respiro. */}
        <div className="mt-4 rounded-2xl border border-[color:var(--color-hairline)] bg-background p-3.5 text-left">
          <div className="flex items-center gap-3">
            <DriverAvatar name={current.driverName} avatarUrl={current.avatarUrl} size={40} />
            <div className="min-w-0 flex-1">
              <p className="break-words font-semibold leading-tight">{current.driverName}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Seu motorista</p>
            </div>
          </div>

          <div className="mt-3 space-y-3 border-t border-[color:var(--color-hairline)] pt-3">
            <InfoRow icon={<CalendarCheck size={15} />} label="Quando">
              {whenLabel(current.when)}
            </InfoRow>
            {current.origin && (
              <InfoRow icon={<MapPin size={15} />} label="Saída">
                {current.origin}
              </InfoRow>
            )}
            {current.destination && (
              <InfoRow icon={<Flag size={15} />} label="Destino">
                {current.destination}
              </InfoRow>
            )}
          </div>
        </div>

        <p className="mt-3.5 text-[12px] leading-snug text-muted-foreground">
          Ela já está na sua agenda — você recebe um aviso antes do horário.
        </p>

        {/* Botões presos no rodapé do cartão: em tela baixa o cartão rola, mas
            "Ver na agenda" e "Fechar" ficam sempre à vista. O -mx/-mb cobre o
            padding do cartão. */}
        <div className="sticky bottom-0 -mx-5 -mb-5 mt-3 bg-card px-5 pb-5 pt-2">
          <button onClick={onSeeAgenda} className="btn-primary flex w-full items-center justify-center">
            Ver na agenda
          </button>
          <button onClick={onClose} className="mt-1 w-full py-2.5 text-[13px] font-semibold text-muted-foreground">
            {more > 0 ? `Fechar (mais ${more})` : "Fechar"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

import { Bell, CalendarClock, ChevronDown, History } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ScreenHeader } from "../components/AppShell";
import { CancelRideControl } from "../components/CancelRideControl";
import { HISTORY_LABEL, HISTORY_LIMIT, historyStatus, rideTime, splitAgenda } from "@/lib/agenda";
import { useRideRequests, useLinks } from "@/lib/hooks";
import { getCachedDriverName } from "@/lib/repository";
import type { ChatMessage } from "@/integrations/supabase/types";

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

function dayLabel(at: number, now: number) {
  const diffDays = Math.round((startOfDay(new Date(at)) - startOfDay(new Date(now))) / 86_400_000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanhã";
  return new Date(at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function timeLabel(at: number) {
  return new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function countdown(ms: number) {
  if (ms <= 0) return "agora";
  const m = Math.ceil(ms / 60_000);
  if (m < 60) return `em ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `em ${h} h ${m % 60} min` : `em ${h} h`;
  const d = Math.floor(h / 24);
  return `em ${d} ${d === 1 ? "dia" : "dias"}`;
}

// Mesmas cores da agenda do motorista: verde (longe), amarelo (até 40 min),
// vermelho (menos de 10 min).
function tone(ms: number) {
  const mins = ms / 60_000;
  if (mins < 10) return { text: "text-destructive", dot: "bg-destructive" };
  if (mins <= 40) return { text: "text-warning", dot: "bg-warning" };
  return { text: "text-success", dot: "bg-success" };
}

function RouteLine({ filled, children }: { filled?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${
          filled ? "bg-primary" : "border-2 border-muted-foreground"
        }`}
      />
      {/* Endereço quebra em até 3 linhas (não corta com "…" numa linha só). */}
      <p className="line-clamp-3 min-w-0 flex-1 break-words text-[13px] leading-snug text-muted-foreground">{children}</p>
    </div>
  );
}

/** Cartão de uma corrida confirmada na Agenda (separado da lista pra ser testado sozinho). */
export function AgendaRideCard({
  messageId,
  driverName,
  linkId,
  body,
  originLabel,
  destinationLabel,
  at,
  now,
  isPast,
  cancelledBy,
  onChanged,
}: {
  messageId: string;
  driverName: string;
  linkId: string;
  body: string;
  originLabel: string | null;
  destinationLabel: string | null;
  at: number;
  now: number;
  isPast: boolean;
  /** Quem cancelou (corrida cancelada), ou null/undefined se segue de pé. */
  cancelledBy?: "driver" | "passenger" | null;
  /** Depois de cancelar: a lista busca de novo. */
  onChanged: () => void;
}) {
  const ms = at - now;
  const t = tone(ms);
  const cancelled = cancelledBy !== undefined && cancelledBy !== null;
  return (
    <div className={`card-elevated p-4 ${isPast || cancelled ? "opacity-60" : ""}`}>
      {/* O cartão abre a conversa; o botão de cancelar fica FORA do link pra não abrir a conversa ao tocar nele. */}
      <Link to={`/chat/${linkId}`} className="block">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="break-words font-semibold leading-tight">{driverName}</p>
            <p className="mt-1 text-label capitalize">{dayLabel(at, now)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-[22px] font-black leading-none tracking-tight ${cancelled ? "line-through" : ""}`}>
              {timeLabel(at)}
            </p>
            {cancelled ? null : isPast ? (
              <p className="mt-1.5 text-[10px] font-bold text-muted-foreground">ANTERIOR</p>
            ) : (
              <p className={`mt-1.5 flex items-center justify-end gap-1 whitespace-nowrap text-[11px] font-bold ${t.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
                {countdown(ms)}
              </p>
            )}
          </div>
        </div>

        {originLabel || destinationLabel ? (
          <div className="mt-3 space-y-2 border-t border-[color:var(--color-hairline)] pt-3">
            {originLabel && <RouteLine filled>{originLabel}</RouteLine>}
            {destinationLabel && <RouteLine>{destinationLabel}</RouteLine>}
          </div>
        ) : (
          <p className="mt-3 break-words border-t border-[color:var(--color-hairline)] pt-3 text-label">{body}</p>
        )}

        {cancelled ? (
          <p className="mt-3 flex items-center gap-1 text-[10px] font-bold uppercase text-destructive">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
            {cancelledBy === "driver" ? "Cancelada pelo motorista" : "Cancelada por você"}
          </p>
        ) : (
          <p className="mt-3 flex items-center gap-1 text-[10px] font-bold text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            CONFIRMADA
          </p>
        )}
      </Link>

      {/* Só dá pra cancelar corrida que ainda não passou do horário (a que já saiu se resolve com o motorista). */}
      {!cancelled && !isPast && (
        <CancelRideControl
          messageId={messageId}
          kind="ride"
          driverName={driverName.split(" ")[0] ?? ""}
          onDone={onChanged}
        />
      )}
    </div>
  );
}

/**
 * Histórico: o que já saiu da Agenda (1 dia depois do horário, feito ou não, ou depois de cancelado).
 * Bem discreto: fechado por padrão, uma linha pequena por corrida. Nada é apagado do banco.
 */
export function AgendaHistory({ items, nameFor }: { items: ChatMessage[]; nameFor: (linkId: string) => string }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const shown = items.slice(0, HISTORY_LIMIT);
  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-1 py-1 text-[11px] font-semibold text-muted-foreground"
      >
        <span className="flex items-center gap-1.5">
          <History size={13} />
          Histórico · {items.length}
        </span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-2 divide-y divide-[color:var(--color-hairline)] overflow-hidden rounded-2xl border border-[color:var(--color-hairline)]">
          {shown.map((m) => {
            const at = rideTime(m);
            const status = historyStatus(m);
            return (
              <li key={m.id} className="flex items-center gap-2.5 px-3 py-2 text-[12px]">
                <span className="w-[72px] shrink-0 tabular-nums text-muted-foreground">
                  {new Date(at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} {timeLabel(at)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {nameFor(m.link_id).split(" ")[0]} · {m.destination_label ?? m.body}
                </span>
                <span
                  className={`shrink-0 text-[10px] font-bold uppercase ${
                    status === "confirmed" ? "text-muted-foreground" : status === "unanswered" ? "text-muted-foreground/70" : "text-destructive"
                  }`}
                >
                  {HISTORY_LABEL[status]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function Agenda() {
  const { links } = useLinks();
  const { rides, refetch } = useRideRequests();
  const [now, setNow] = useState(() => Date.now());
  const driverIdByLink = new Map(links.map((l) => [l.id, l.driver_id]));
  const nameFor = (linkId: string) => {
    const driverId = driverIdByLink.get(linkId);
    return driverId ? getCachedDriverName(driverId) : "Motorista";
  };

  // Contagem regressiva viva, e a lista se atualiza sozinha (uma corrida
  // confirmada agora pelo motorista aparece aqui sem precisar sair e voltar).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(refetch, 60_000);
    return () => clearInterval(id);
  }, [refetch]);

  // Quem sai da Agenda (1 dia depois do horário / do cancelamento) vai pro Histórico: ver lib/agenda.ts.
  const { upcoming, recent, cancelled, history } = splitAgenda(rides, now);

  function card(ride: ChatMessage, isPast: boolean) {
    return (
      <AgendaRideCard
        key={ride.id}
        messageId={ride.id}
        driverName={nameFor(ride.link_id)}
        linkId={ride.link_id}
        body={ride.body}
        originLabel={ride.origin_label}
        destinationLabel={ride.destination_label}
        at={rideTime(ride)}
        now={now}
        isPast={isPast}
        cancelledBy={ride.cancelled_at ? (ride.cancelled_by ?? "driver") : null}
        onChanged={refetch}
      />
    );
  }

  const nothingOnAgenda = upcoming.length + recent.length + cancelled.length === 0;

  return (
    <div>
      <ScreenHeader title="Corridas agendadas" subtitle="Confirmadas pelos motoristas no chat" />

      <div className="space-y-2 px-5 pb-6">
        {nothingOnAgenda && (
          <div className={`flex flex-col items-center gap-3 px-6 text-center text-muted-foreground ${history.length > 0 ? "mt-10" : "mt-16"}`}>
            <CalendarClock size={40} />
            <p className="text-body">Nenhuma corrida confirmada ainda. Peça uma corrida pra algum motorista no chat.</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <div className="mb-1 flex items-center gap-2 rounded-2xl bg-primary-soft px-3.5 py-2.5 text-[11px] font-semibold text-primary">
              <Bell size={14} className="shrink-0" />
              Você recebe um aviso 40, 20, 10 e 5 minutos antes, e na hora da corrida.
            </div>
            {upcoming.map((r) => card(r, false))}
          </>
        )}

        {recent.length > 0 && (
          <>
            <p className="section-label mb-1 mt-6">Anteriores</p>
            {recent.map((r) => card(r, true))}
          </>
        )}

        {cancelled.length > 0 && (
          <>
            <p className="section-label mb-1 mt-6">Canceladas</p>
            {cancelled.map((r) => card(r, true))}
          </>
        )}

        <AgendaHistory items={history} nameFor={nameFor} />
      </div>
    </div>
  );
}

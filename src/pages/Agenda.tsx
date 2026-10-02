import { Bell, CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ScreenHeader } from "../components/AppShell";
import { useConfirmedRides, useLinks } from "@/lib/hooks";
import { getCachedDriverName } from "@/lib/repository";
import type { ChatMessage } from "@/integrations/supabase/types";

// Passou disso do horário, a corrida vai pra "Anteriores".
const PAST_AFTER_MS = 30 * 60_000;

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

type Item = { ride: ChatMessage; at: number };

export function Agenda() {
  const { links } = useLinks();
  const { rides, refetch } = useConfirmedRides();
  const [now, setNow] = useState(() => Date.now());
  const driverIdByLink = new Map(links.map((l) => [l.id, l.driver_id]));

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

  const items: Item[] = rides.map((ride) => ({ ride, at: new Date(ride.requested_at ?? ride.created_at).getTime() }));
  const upcoming = items.filter((i) => i.at >= now - PAST_AFTER_MS).sort((a, b) => a.at - b.at);
  const past = items.filter((i) => i.at < now - PAST_AFTER_MS).sort((a, b) => b.at - a.at);

  function card({ ride, at }: Item, isPast: boolean) {
    const driverId = driverIdByLink.get(ride.link_id);
    const driverName = driverId ? getCachedDriverName(driverId) : "Motorista";
    const ms = at - now;
    const t = tone(ms);
    return (
      <Link
        key={ride.id}
        to={`/chat/${ride.link_id}`}
        className={`card-elevated block p-4 ${isPast ? "opacity-60" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{driverName}</p>
            <p className="mt-0.5 text-label capitalize">{dayLabel(at, now)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[22px] font-black leading-none tracking-tight">{timeLabel(at)}</p>
            {isPast ? (
              <p className="mt-1.5 text-[10px] font-bold text-muted-foreground">ANTERIOR</p>
            ) : (
              <p className={`mt-1.5 flex items-center justify-end gap-1 text-[11px] font-bold ${t.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
                {countdown(ms)}
              </p>
            )}
          </div>
        </div>

        {ride.origin_label || ride.destination_label ? (
          <div className="mt-3 space-y-1 border-t border-[color:var(--color-hairline)] pt-3 text-label">
            {ride.origin_label && (
              <p className="truncate">
                <span className="text-primary">•</span> {ride.origin_label}
              </p>
            )}
            {ride.destination_label && <p className="truncate">◦ {ride.destination_label}</p>}
          </div>
        ) : (
          <p className="mt-3 border-t border-[color:var(--color-hairline)] pt-3 text-label">{ride.body}</p>
        )}

        <p className="mt-3 flex items-center gap-1 text-[10px] font-bold text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          CONFIRMADA
        </p>
      </Link>
    );
  }

  return (
    <div>
      <ScreenHeader title="Corridas agendadas" subtitle="Confirmadas pelos motoristas no chat" />

      <div className="space-y-2 px-5 pb-6">
        {rides.length === 0 && (
          <div className="mt-16 flex flex-col items-center gap-3 px-6 text-center text-muted-foreground">
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
            {upcoming.map((i) => card(i, false))}
          </>
        )}

        {past.length > 0 && (
          <>
            <p className="section-label mb-1 mt-6">Anteriores</p>
            {past.map((i) => card(i, true))}
          </>
        )}
      </div>
    </div>
  );
}

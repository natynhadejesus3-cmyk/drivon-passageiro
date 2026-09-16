import { CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import { ScreenHeader } from "../components/AppShell";
import { useConfirmedRides, useLinks } from "@/lib/hooks";
import { getCachedDriverName } from "@/lib/repository";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function Agenda() {
  const { links } = useLinks();
  const { rides } = useConfirmedRides();
  const driverIdByLink = new Map(links.map((l) => [l.id, l.driver_id]));

  return (
    <div>
      <ScreenHeader title="Corridas agendadas" subtitle="Confirmadas pelos motoristas no chat" />

      <div className="space-y-2 px-5">
        {rides.length === 0 && (
          <div className="mt-16 flex flex-col items-center gap-3 px-6 text-center text-muted-foreground">
            <CalendarClock size={40} />
            <p className="text-body">Nenhuma corrida confirmada ainda. Peça uma corrida pra algum motorista no chat.</p>
          </div>
        )}
        {rides.map((ride) => {
          const driverId = driverIdByLink.get(ride.link_id);
          const driverName = driverId ? getCachedDriverName(driverId) : "Motorista";
          return (
            <Link key={ride.id} to={`/chat/${ride.link_id}`} className="card-elevated block p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{driverName}</p>
                <span className="flex items-center gap-1 text-[10px] font-bold text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  CONFIRMADA
                </span>
              </div>
              <p className="mt-1 text-label">{ride.body}</p>
              <p className="mt-1 text-label opacity-70">{formatDateTime(ride.created_at)}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

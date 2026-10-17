import { Car } from "lucide-react";

type Vehicle = "car" | "moto";

/** Lista válida a partir do que vier do banco (perfil antigo, sem a coluna, vale como carro). */
export function vehiclesOf(v: unknown): Vehicle[] {
  const list = Array.isArray(v) ? v : [];
  const out = (["car", "moto"] as const).filter((x) => list.includes(x));
  return out.length > 0 ? out : ["car"];
}

function MotoIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="5.5" cy="16.5" r="3" />
      <circle cx="18.5" cy="16.5" r="3" />
      <path d="M5.5 16.5 9 9h4l2.5 4.5M13 9l1.5-3H17M9 9H6.5M15.5 13.5h3" />
    </svg>
  );
}

/** Etiquetas "Carro" e/ou "Moto" do motorista, pra o passageiro escolher quem tem o veículo que quer. */
export function VehicleBadges({ vehicles, size = "sm" }: { vehicles: unknown; size?: "sm" | "md" }) {
  const list = vehiclesOf(vehicles);
  const icon = size === "md" ? 14 : 12;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {list.map((v) => (
        <span
          key={v}
          className={`inline-flex items-center gap-1 rounded-full font-bold ${
            v === "moto" ? "bg-primary/15 text-primary" : "bg-muted text-foreground"
          } ${size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]"}`}
        >
          {v === "moto" ? <MotoIcon size={icon} /> : <Car size={icon} />}
          {v === "moto" ? "Moto" : "Carro"}
        </span>
      ))}
    </span>
  );
}
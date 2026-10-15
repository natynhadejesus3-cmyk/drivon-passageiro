import { Calendar, Clock, Minus, Plus } from "lucide-react";
import { useMemo } from "react";
import { buildDayOptions, splitTime, stepHour, stepMinute } from "@/lib/ride-when";

/**
 * Dia e horário do "Pedir corrida", feitos de botões comuns dentro do próprio app.
 * O calendário e o relógio NATIVOS do Android não abriam neste app (a pessoa tocava no campo e nada acontecia);
 * botões da página funcionam em qualquer celular. Os valores continuam sendo "YYYY-MM-DD" e "HH:MM",
 * então o resto do formulário (rascunho, aviso de horário passado, envio) não muda.
 */
function Stepper({
  label,
  value,
  onUp,
  onDown,
}: {
  label: string;
  value: string;
  onUp: () => void;
  onDown: () => void;
}) {
  const btn =
    "grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[color:var(--color-hairline)] bg-background text-foreground active:bg-primary-soft";
  return (
    <div className="flex flex-1 flex-col items-center">
      <span className="section-label mb-1.5">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onDown} aria-label={`Diminuir ${label.toLowerCase()}`} className={btn}>
          <Minus size={16} />
        </button>
        <span className="w-12 text-center text-[26px] font-black tabular-nums leading-none">{value}</span>
        <button type="button" onClick={onUp} aria-label={`Aumentar ${label.toLowerCase()}`} className={btn}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

export function RideWhenPicker({
  date,
  time,
  onDate,
  onTime,
}: {
  date: string;
  time: string;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
}) {
  // A lista de dias é refeita quando o dia escolhido muda (e a cada abertura da folha, já que ela é montada de novo).
  const days = useMemo(() => buildDayOptions(new Date(), date), [date]);
  const { h, m } = splitTime(time);

  return (
    <div className="mt-4">
      <span className="section-label mb-2 flex items-center gap-1.5">
        <Calendar size={12} />
        Dia
      </span>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d) => {
          const on = d.value === date;
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => onDate(d.value)}
              aria-pressed={on}
              className={`shrink-0 rounded-xl border px-3.5 py-2 text-center ${
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-[color:var(--color-hairline)] bg-background text-foreground"
              }`}
            >
              <span className="block text-[13px] font-bold leading-tight">{d.label}</span>
              <span className={`block text-[11px] leading-tight ${on ? "opacity-90" : "text-muted-foreground"}`}>{d.sub}</span>
            </button>
          );
        })}
      </div>

      <span className="section-label mb-2 mt-4 flex items-center gap-1.5">
        <Clock size={12} />
        Horário
      </span>
      <div className="flex items-end justify-center gap-3 rounded-2xl border border-[color:var(--color-hairline)] bg-background px-3 py-3">
        <Stepper
          label="Hora"
          value={String(h).padStart(2, "0")}
          onUp={() => onTime(stepHour(time, 1))}
          onDown={() => onTime(stepHour(time, -1))}
        />
        <span className="pb-2 text-[26px] font-black leading-none text-muted-foreground">:</span>
        <Stepper
          label="Min"
          value={String(m).padStart(2, "0")}
          onUp={() => onTime(stepMinute(time, 1))}
          onDown={() => onTime(stepMinute(time, -1))}
        />
      </div>
    </div>
  );
}

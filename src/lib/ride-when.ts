/**
 * Regras (sem React) dos botões de DIA e HORÁRIO do "Pedir corrida". Trabalham com os mesmos textos que o
 * formulário já usava: dia "YYYY-MM-DD" e horário "HH:MM" (o resto do formulário não muda).
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" no relógio do celular (não em UTC: no Brasil, UTC já vira "amanhã" depois das 21h). */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDay(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export type DayOption = { value: string; label: string; sub: string };

/** "Hoje", "Amanhã" e, depois, "seg." / "16/10". */
function optionFor(key: string, today: Date): DayOption {
  const d = parseDay(key)!;
  const diff = Math.round((d.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  if (diff === 0) return { value: key, label: "Hoje", sub: date };
  if (diff === 1) return { value: key, label: "Amanhã", sub: date };
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return { value: key, label: weekday.charAt(0).toUpperCase() + weekday.slice(1), sub: date };
}

/**
 * Os próximos `count` dias a partir de hoje. Se o dia já escolhido (ex.: rascunho salvo) estiver depois disso,
 * ele entra no fim da lista pra continuar aparecendo selecionado. Dia no passado não entra.
 */
export function buildDayOptions(today: Date, selected: string, count = 14): DayOption[] {
  const out: DayOption[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    out.push(optionFor(dayKey(d), today));
  }
  const sel = parseDay(selected);
  const first = out[0]!.value;
  if (sel && selected > first && !out.some((o) => o.value === selected)) out.push(optionFor(selected, today));
  return out;
}

export function splitTime(time: string): { h: number; m: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  const h = m ? Number(m[1]) : 0;
  const mi = m ? Number(m[2]) : 0;
  return { h: Math.min(Math.max(h, 0), 23), m: Math.min(Math.max(mi, 0), 59) };
}

export const joinTime = (h: number, m: number) => `${pad(h)}:${pad(m)}`;

/** Hora +1 / -1, dando a volta (23 -> 00). Os minutos ficam como estão. */
export function stepHour(time: string, dir: 1 | -1): string {
  const { h, m } = splitTime(time);
  return joinTime((h + dir + 24) % 24, m);
}

/**
 * Minuto +1 / -1 de 5 em 5. Se o minuto atual não é múltiplo de 5 (ex.: "agora", 14:37), o primeiro toque vai pro
 * múltiplo mais próximo na direção do toque (14:40 pra cima, 14:35 pra baixo). Passou de 59 / abaixo de 0: dá a
 * volta SEM mexer na hora (a hora tem os próprios botões).
 */
export function stepMinute(time: string, dir: 1 | -1, step = 5): string {
  const { h, m } = splitTime(time);
  const next = dir === 1 ? (Math.floor(m / step) + 1) * step : (Math.ceil(m / step) - 1) * step;
  return joinTime(h, ((next % 60) + 60) % 60);
}

/**
 * Valor estimado da corrida = distância (km) x preço por km do motorista, arredondado em centavos,
 * com a TARIFA NOTURNA de +30% quando a corrida cai entre 22h e 5h (horário de Brasília).
 *
 * É a MESMA conta do motor central do app do motorista (src/lib/pricing/fare-calculator.ts do Drivon:
 * round2 com Number.EPSILON, base arredondada e depois +30% arredondado). Tem que continuar idêntica,
 * senão motorista e passageiro veem valores diferentes (centavo de diferença já conta).
 * Teste com valores de referência: scripts/fare.test.ts.
 */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const NIGHT_SURCHARGE_PCT = 30;
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 5;

/** Hora cheia (0-23) em Brasília de um instante. */
export function hourInBrazil(at: Date | string | number): number {
  const d = at instanceof Date ? at : new Date(at);
  if (!Number.isFinite(d.getTime())) return 12;
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(d);
  return Number(h) % 24;
}

/** O instante cai na janela da tarifa noturna (22h às 5h)? */
export function isNightFare(at?: Date | string | number | null): boolean {
  if (at == null) return false;
  const h = hourInBrazil(at);
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
}

export type FareDetail = { base: number; surcharge: number; total: number; isNight: boolean };

/**
 * `at` = quando a corrida vai acontecer (o horário que o passageiro escolheu). Sem `at` não há
 * tarifa noturna (vale o valor base).
 */
export function rideFareDetail(distanceKm: number, pricePerKm: number, at?: Date | string | number | null): FareDetail {
  const km = Number.isFinite(distanceKm) ? Math.max(0, distanceKm) : 0;
  const rate = Number.isFinite(pricePerKm) ? Math.max(0, pricePerKm) : 0;
  const base = round2(km * rate);
  const isNight = isNightFare(at);
  const surcharge = isNight ? round2(base * (NIGHT_SURCHARGE_PCT / 100)) : 0;
  return { base, surcharge, total: round2(base + surcharge), isNight };
}

export function rideFare(distanceKm: number, pricePerKm: number, at?: Date | string | number | null): number {
  return rideFareDetail(distanceKm, pricePerKm, at).total;
}
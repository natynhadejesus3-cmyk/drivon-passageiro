/**
 * A estimativa do passageiro tem que dar o MESMO valor que o motor de cálculo do app do motorista.
 * Os valores abaixo foram gerados pelo motor do motorista (calculateRideFare, Drivon).
 * Rodar com: bun run scripts/fare.test.ts
 */
import { isNightFare, rideFare, rideFareDetail } from "../src/lib/fare";

const results: string[] = [];
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? "PASS" : "FAIL"} — ${name}${ok ? "" : ` (esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)})`}`);
  if (!ok) process.exitCode = 1;
}

// [km, R$/km, total do motor do motorista]
const REFERENCE: [number, number, number][] = [
  [4.2, 2.8, 11.76],
  [12.375, 2.75, 34.03],
  [7.34821, 3, 22.04],
  [0, 2.8, 0],
  [1.005, 2, 2.01],
  [10, 3.5, 35],
  [0.4, 2.8, 1.12],
  [23.7149, 2.35, 55.73],
  [5.555, 1, 5.56],
  [9.999, 2.8, 28],
];
for (const [km, perKm, total] of REFERENCE) {
  check(`${km} km x R$ ${perKm}/km = R$ ${total} (igual ao motorista)`, rideFare(km, perKm), total);
}

// Tarifa noturna (+30%, 22h às 5h): valores gerados pelo motor do motorista com a corrida às 23h de Brasília.
const NOITE_REF: [number, number, number][] = [
  [4.2, 2.8, 15.29],
  [12.375, 2.75, 44.24],
  [7.34821, 3, 28.65],
  [0, 2.8, 0],
  [1.005, 2, 2.61],
  [10, 3.5, 45.5],
  [0.4, 2.8, 1.46],
  [23.7149, 2.35, 72.45],
  [5.555, 1, 7.23],
  [9.999, 2.8, 36.4],
];
for (const [km, perKm, total] of NOITE_REF) {
  check(`NOITE: ${km} km x R$ ${perKm}/km = R$ ${total} (igual ao motorista)`, rideFare(km, perKm, "2026-10-16T23:00:00-03:00"), total);
}
check("sem horário não há tarifa noturna (valor base)", rideFare(10, 3.5), 35);
check("de dia (12h) não soma", rideFare(10, 3.5, "2026-10-16T12:00:00-03:00"), 35);
check("detalhe da noite: base, soma e total", rideFareDetail(10, 3.5, "2026-10-16T23:00:00-03:00"), { base: 35, surcharge: 10.5, total: 45.5, isNight: true });
check("21:59 dia / 22:00 noite / 04:59 noite / 05:00 dia", ["21:59", "22:00", "04:59", "05:00"].map((h) => isNightFare(`2026-10-16T${h}:00-03:00`)), [false, true, true, false]);
check("vale o horário de Brasília mesmo em UTC (01:30Z = 22:30 BRT)", isNightFare("2026-10-17T01:30:00Z"), true);
check("aceita Date", isNightFare(new Date("2026-10-16T23:00:00-03:00")), true);
check("entrada inválida vira zero, nunca NaN", [rideFare(NaN, 2.8), rideFare(5, NaN), rideFare(-3, 2.8)], [0, 0, 0]);

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram`);

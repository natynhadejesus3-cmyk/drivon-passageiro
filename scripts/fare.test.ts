/**
 * A estimativa do passageiro tem que dar o MESMO valor que o motor de cálculo do app do motorista.
 * Os valores abaixo foram gerados pelo motor do motorista (calculateRideFare, Drivon).
 * Rodar com: bun run scripts/fare.test.ts
 */
import { rideFare } from "../src/lib/fare";

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

check("entrada inválida vira zero, nunca NaN", [rideFare(NaN, 2.8), rideFare(5, NaN), rideFare(-3, 2.8)], [0, 0, 0]);

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram`);

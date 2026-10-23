/**
 * Avisos do motorista no chat: o texto que o app do motorista manda tem que continuar sendo reconhecido aqui.
 * Rodar com: bun run scripts/driver-notices.test.ts
 */
import { isArrivalMessage, parsePickupMessage } from "../src/lib/driver-notices";

const results: string[] = [];
let total = 0;
let passed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  total++;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed++;
  results.push(`${ok ? "PASS" : "FAIL"} — ${name}${ok ? "" : ` (esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)})`}`);
  if (!ok) process.exitCode = 1;
}

// Texto exato que o app do motorista manda (copiado de pricing/pickup-fee.ts e rides/arrival.ts).
const PICKUP =
  "🚗 Estou indo até o ponto de embarque! Deslocamento até você: R$ 16,55 (5,9 km). Total da corrida: R$ 18,24 (R$ 1,69 da corrida + R$ 16,55 do deslocamento).";
const ARRIVAL = "🚗 Cheguei ao local de embarque! Estou te esperando.";

check("lê o aviso 'Estou indo'", parsePickupMessage(PICKUP), { fee: "R$ 16,55", km: "5,9", total: "R$ 18,24", ride: "R$ 1,69" });
check("mensagem comum não é 'Estou indo'", parsePickupMessage("Oi, tudo bem?"), null);
check("vazio/nulo não quebram", [parsePickupMessage(""), parsePickupMessage(null), parsePickupMessage(undefined)], [null, null, null]);
check("reconhece o aviso de chegada", isArrivalMessage(ARRIVAL), true);
check("espaço na frente não atrapalha", isArrivalMessage(`  ${ARRIVAL}`), true);
check("mensagem comum não é aviso de chegada", isArrivalMessage("Já estou chegando!"), false);
check("vazio/nulo não são aviso de chegada", [isArrivalMessage(""), isArrivalMessage(null)], [false, false]);

console.log(results.join("\n"));
console.log(`\n${passed}/${total} verificações passaram`);

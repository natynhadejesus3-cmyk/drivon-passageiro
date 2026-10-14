/**
 * A Agenda do passageiro: corrida some 1 dia depois do horário (ou do cancelamento) e vai pro Histórico.
 * Rodar com: bun run scripts/agenda.test.ts
 */
import {
  HIDE_AFTER_MS,
  PAST_AFTER_MS,
  hideAt,
  historyStatus,
  splitAgenda,
  type RideRequest,
} from "../src/lib/agenda";

const results: string[] = [];
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? "PASS" : "FAIL"} — ${name}${ok ? "" : ` (esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)})`}`);
  if (!ok) process.exitCode = 1;
}

const NOW = Date.parse("2026-10-15T15:00:00.000Z");
const H = 60 * 60_000;
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

function ride(id: string, atOffsetMs: number, over: Partial<RideRequest> = {}): RideRequest {
  return {
    id,
    link_id: "l1",
    body: "pedido",
    origin_label: "Rua A",
    destination_label: "Rua B",
    requested_at: iso(atOffsetMs),
    created_at: iso(atOffsetMs - H),
    ride_confirmed: true,
    is_ride_request: true,
    cancelled_at: null,
    cancelled_by: null,
    ...over,
  };
}
const ids = (xs: RideRequest[]) => xs.map((x) => x.id);

check("constantes: 30 min pra 'anterior', 1 dia pra sumir da Agenda", [PAST_AFTER_MS, HIDE_AFTER_MS], [30 * 60_000, 24 * H]);

// --- Situações de corrida confirmada ---------------------------------------------------------
const s = splitAgenda(
  [
    ride("futura-2", 5 * H),
    ride("futura-1", 1 * H),
    ride("saindo-agora", -10 * 60_000), // começou há 10 min: ainda é "próxima"
    ride("passou-1h", -1 * H),
    ride("passou-20h", -20 * H),
    ride("passou-25h", -25 * H), // mais de 1 dia: Histórico
    ride("passou-5d", -5 * 24 * H),
  ],
  NOW,
);
check("próximas: da mais cedo pra mais tarde (inclui a que começou há 10 min)", ids(s.upcoming), ["saindo-agora", "futura-1", "futura-2"]);
check("anteriores: só até 1 dia, mais recente primeiro", ids(s.recent), ["passou-1h", "passou-20h"]);
check("Histórico: o que passou de 1 dia, mais recente primeiro", ids(s.history), ["passou-25h", "passou-5d"]);

// --- A virada exata de 1 dia ------------------------------------------------------------------
check("23h59 depois do horário: ainda na Agenda", ids(splitAgenda([ride("x", -(24 * H - 60_000))], NOW).recent), ["x"]);
check("exatamente 1 dia depois do horário: já foi pro Histórico", ids(splitAgenda([ride("x", -24 * H)], NOW).history), ["x"]);

// --- Canceladas --------------------------------------------------------------------------------
const c = splitAgenda(
  [
    ride("cancelada-ha-2h", 3 * H, { cancelled_at: iso(-2 * H), cancelled_by: "passenger" }), // horário no futuro, cancelada há 2h
    ride("cancelada-ha-30h", 3 * H, { cancelled_at: iso(-30 * H), cancelled_by: "driver" }), // cancelada há mais de 1 dia
  ],
  NOW,
);
check("cancelada há pouco fica em 'Canceladas'", ids(c.cancelled), ["cancelada-ha-2h"]);
check("cancelada há mais de 1 dia vai pro Histórico, mesmo com horário no futuro", ids(c.history), ["cancelada-ha-30h"]);
check("cancelada some das próximas", c.upcoming.length, 0);
check("o prazo conta do cancelamento (não do horário)", hideAt(ride("a", 3 * H, { cancelled_at: iso(-2 * H) })), NOW - 2 * H + HIDE_AFTER_MS);

// --- Pedidos que nunca viraram corrida -----------------------------------------------------------
const p = splitAgenda(
  [
    ride("aguardando", 2 * H, { ride_confirmed: false }),
    ride("sem-resposta-velho", -30 * H, { ride_confirmed: false }),
    ride("cancelado-antes-de-aceitar", -30 * H, { ride_confirmed: false, cancelled_at: iso(-29 * H), cancelled_by: "passenger" }),
    { ...ride("mensagem-comum", 1 * H), is_ride_request: false },
  ],
  NOW,
);
check("pedido ainda sem resposta não aparece na Agenda", [p.upcoming.length, p.recent.length, p.cancelled.length], [0, 0, 0]);
check("pedidos velhos (sem resposta / cancelados antes de aceitar) vão pro Histórico", ids(p.history), ["sem-resposta-velho", "cancelado-antes-de-aceitar"]);
check("mensagem comum nunca entra", [...ids(p.upcoming), ...ids(p.history)].includes("mensagem-comum"), false);

// --- Pedido antigo sem horário (usa a hora do pedido) --------------------------------------------
const old = { ...ride("antigo", 0), requested_at: null, created_at: iso(-26 * H) };
check("sem horário pedido: vale a hora em que foi feito", ids(splitAgenda([old], NOW).history), ["antigo"]);

// --- Texto da situação no Histórico ---------------------------------------------------------------
check(
  "situação no Histórico",
  [
    historyStatus({ ride_confirmed: true, cancelled_at: null, cancelled_by: null }),
    historyStatus({ ride_confirmed: false, cancelled_at: null, cancelled_by: null }),
    historyStatus({ ride_confirmed: true, cancelled_at: iso(-H), cancelled_by: "passenger" }),
    historyStatus({ ride_confirmed: true, cancelled_at: iso(-H), cancelled_by: "driver" }),
    historyStatus({ ride_confirmed: true, cancelled_at: iso(-H), cancelled_by: null }),
  ],
  ["confirmed", "unanswered", "cancelled_by_me", "cancelled_by_driver", "cancelled_by_me"],
);

// --- Entrada vazia ---------------------------------------------------------------------------------
check("sem nada: tudo vazio", splitAgenda([], NOW), { upcoming: [], recent: [], cancelled: [], history: [] });

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram`);

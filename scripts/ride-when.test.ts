/**
 * Botões de dia e horário do Pedir corrida (no lugar do calendário/relógio nativos, que no celular não abriam).
 * Rodar com: bun run scripts/ride-when.test.ts
 */
import { buildDayOptions, dayKey, joinTime, splitTime, stepHour, stepMinute } from "../src/lib/ride-when";

const results: string[] = [];
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? "PASS" : "FAIL"} — ${name}${ok ? "" : ` (esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)})`}`);
  if (!ok) process.exitCode = 1;
}

// quarta-feira, 14/10/2026, 22:30 no relógio do celular (a data em UTC já seria dia 15: não pode usar UTC)
const TODAY = new Date(2026, 9, 14, 22, 30);

check("dia no relógio do celular (não em UTC)", dayKey(TODAY), "2026-10-14");

const days = buildDayOptions(TODAY, "2026-10-14");
check("14 dias a partir de hoje", [days.length, days[0]!.value, days[13]!.value], [14, "2026-10-14", "2026-10-27"]);
check("os dois primeiros são Hoje e Amanhã, com a data embaixo", [days[0], days[1]], [{ value: "2026-10-14", label: "Hoje", sub: "14/10" }, { value: "2026-10-15", label: "Amanhã", sub: "15/10" }]);
check("o resto mostra o dia da semana abreviado, em português", [days[2]!.label, days[2]!.sub, days[3]!.label], ["Sex", "16/10", "Sáb"]);
check("virada de mês e de ano", [buildDayOptions(new Date(2026, 11, 30), "2026-12-30", 4).map((d) => d.value), buildDayOptions(new Date(2026, 11, 30), "2026-12-30", 4)[3]!.sub], [["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"], "02/01"]);

const far = buildDayOptions(TODAY, "2026-12-25");
check("dia escolhido além dos 14 (rascunho) entra no fim, pra continuar selecionado", [far.length, far[14]!.value, far[14]!.sub], [15, "2026-12-25", "25/12"]);
check("dia já passado (rascunho velho) não entra", buildDayOptions(TODAY, "2026-10-01").some((d) => d.value === "2026-10-01"), false);
check("dia escolhido já dentro da lista não duplica", buildDayOptions(TODAY, "2026-10-20").length, 14);
check("valor inválido não quebra", buildDayOptions(TODAY, "lixo").length, 14);

// horário
check("lê e junta o horário", [splitTime("09:05"), joinTime(9, 5), splitTime("lixo")], [{ h: 9, m: 5 }, "09:05", { h: 0, m: 0 }]);
check("hora +1 e -1, dando a volta", [stepHour("22:30", 1), stepHour("23:30", 1), stepHour("00:15", -1), stepHour("10:30", -1)], ["23:30", "00:30", "23:15", "09:30"]);
check("a hora não mexe nos minutos", stepHour("14:37", 1), "15:37");
check("minuto de 5 em 5", [stepMinute("14:30", 1), stepMinute("14:30", -1), stepMinute("14:00", -1), stepMinute("14:55", 1)], ["14:35", "14:25", "14:55", "14:00"]);
check("minuto de 'agora' (14:37) vai pro múltiplo de 5 mais próximo na direção do toque", [stepMinute("14:37", 1), stepMinute("14:37", -1), stepMinute("14:35", 1), stepMinute("14:35", -1)], ["14:40", "14:35", "14:40", "14:30"]);
check("minuto dá a volta sem mexer na hora", [stepMinute("14:59", 1), stepMinute("14:02", -1), stepMinute("14:00", -1)], ["14:00", "14:00", "14:55"]);

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram`);

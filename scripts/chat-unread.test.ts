/**
 * Validação do "mensagem não lida" e do som de mensagem nova.
 * Rodar com: bun run scripts/chat-unread.test.ts
 */
import { countUnreadAfterMyLast, detectIncoming, unreadLabel } from "../src/lib/chat-unread";

const results: string[] = [];
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? "PASS" : "FAIL"} — ${name}${ok ? "" : ` (esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)})`}`);
  if (!ok) process.exitCode = 1;
}

const msg = (id: string, role: "driver" | "passenger", read = false) => ({ id, sender_role: role, read_at: read ? "2026-10-13T12:00:00Z" : null });

// --- Não lidas (lista vem da mais nova pra mais antiga) ---
check("sem mensagens: 0", countUnreadAfterMyLast([], "driver"), 0);
check("1 mensagem do passageiro sem ler: 1", countUnreadAfterMyLast([msg("a", "passenger")], "driver"), 1);
check("3 seguidas sem ler: 3", countUnreadAfterMyLast([msg("c", "passenger"), msg("b", "passenger"), msg("a", "passenger")], "driver"), 3);
check("já lidas não contam", countUnreadAfterMyLast([msg("b", "passenger", true), msg("a", "passenger", true)], "driver"), 0);
check("RESPONDEU: a última é minha, então não há não lida (some ao responder)", countUnreadAfterMyLast([msg("c", "driver"), msg("b", "passenger"), msg("a", "passenger")], "driver"), 0);
check("passageiro respondeu de novo depois de mim: só conta as novas", countUnreadAfterMyLast([msg("d", "passenger"), msg("c", "driver"), msg("b", "passenger"), msg("a", "passenger")], "driver"), 1);
check("minhas próprias mensagens nunca contam", countUnreadAfterMyLast([msg("a", "driver")], "driver"), 0);
check("vale igual pro passageiro (o outro lado é o motorista)", [countUnreadAfterMyLast([msg("b", "driver"), msg("a", "passenger")], "passenger"), countUnreadAfterMyLast([msg("c", "passenger"), msg("b", "driver")], "passenger")], [1, 0]);

// --- Texto ---
check("texto: singular e plural", [unreadLabel(0), unreadLabel(1), unreadLabel(2), unreadLabel(12)], ["", "Mensagem não lida", "2 mensagens não lidas", "12 mensagens não lidas"]);

// --- Som de mensagem nova ---
{
  const hist = [msg("a", "driver"), msg("b", "passenger")];
  const first = detectIncoming(null, hist, "driver", true);
  check("abrir a conversa NÃO toca por causa do histórico", first.play, false);
  check("... mas memoriza as mensagens que já estavam lá", [...first.seen].sort(), ["a", "b"]);
  const same = detectIncoming(first.seen, hist, "driver", true);
  check("a mesma lista de novo (atualização sem novidade): não toca", same.play, false);
  const incoming = detectIncoming(first.seen, [...hist, msg("c", "passenger")], "driver", true);
  check("chegou mensagem do OUTRO lado com a conversa aberta: toca", incoming.play, true);
  const again = detectIncoming(incoming.seen, [...hist, msg("c", "passenger")], "driver", true);
  check("e não toca de novo pela mesma mensagem", again.play, false);
  const mine = detectIncoming(first.seen, [...hist, msg("d", "driver")], "driver", true);
  check("minha própria mensagem NÃO toca", mine.play, false);
  const hidden = detectIncoming(first.seen, [...hist, msg("e", "passenger")], "driver", false);
  check("app minimizado (não visível): não toca (quem avisa é a notificação)", [hidden.play, hidden.seen.has("e")], [false, true]);
  const burst = detectIncoming(first.seen, [...hist, msg("f", "passenger"), msg("g", "passenger")], "driver", true);
  check("várias de uma vez: toca uma vez só (um aviso)", burst.play, true);
  const passenger = detectIncoming(new Set(["a"]), [msg("a", "passenger"), msg("b", "driver")], "passenger", true);
  check("no app do passageiro, mensagem do motorista toca", passenger.play, true);
}

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram`);

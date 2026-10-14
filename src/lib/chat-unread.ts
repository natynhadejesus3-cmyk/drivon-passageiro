/**
 * Regras de "mensagem não lida" e do som de mensagem nova no chat (testadas por chat-unread.test.ts).
 * O mesmo arquivo existe no app do passageiro (drivon-passenger/src/lib/chat-unread.ts) -- mantenha os dois iguais.
 */

export type ChatRole = "driver" | "passenger";

type Msg = { id?: string; sender_role: string; read_at?: string | null };

/**
 * Quantas mensagens do OUTRO lado estão sem ler, contando só as que vieram DEPOIS da minha última
 * resposta. `newestFirst` precisa estar da mais nova pra mais antiga.
 *
 * Por que parar na minha última mensagem: se a pessoa já respondeu, ela claramente viu o que veio
 * antes -- o aviso "mensagem não lida" some quando ela responde (e também quando abre a conversa,
 * que marca tudo como lido).
 */
export function countUnreadAfterMyLast(newestFirst: Msg[], myRole: ChatRole): number {
  let count = 0;
  for (const m of newestFirst) {
    if (m.sender_role === myRole) break;
    if (!m.read_at) count++;
  }
  return count;
}

/** "Mensagem não lida" / "3 mensagens não lidas" (vazio quando não há nenhuma). */
export function unreadLabel(count: number): string {
  if (count <= 0) return "";
  return count === 1 ? "Mensagem não lida" : `${count} mensagens não lidas`;
}

/**
 * Chegou mensagem nova do OUTRO lado enquanto a conversa está aberta e à vista? Devolve o novo
 * conjunto de ids já vistos e se deve tocar o som. A primeira chamada (`seen` nulo) só "memoriza" o
 * histórico: abrir a conversa não toca nada por causa de mensagens antigas.
 */
export function detectIncoming(
  seen: Set<string> | null,
  messages: { id: string; sender_role: string }[],
  myRole: ChatRole,
  visible: boolean,
): { seen: Set<string>; play: boolean } {
  if (seen === null) return { seen: new Set(messages.map((m) => m.id)), play: false };
  const fresh = messages.filter((m) => !seen.has(m.id));
  const next = new Set(seen);
  for (const m of messages) next.add(m.id);
  return { seen: next, play: visible && fresh.some((m) => m.sender_role !== myRole) };
}

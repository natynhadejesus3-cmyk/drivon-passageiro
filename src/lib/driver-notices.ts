/**
 * Avisos automáticos que o app do motorista manda no chat ("Estou indo até o embarque" e "Cheguei ao local de
 * embarque"). Aqui só se reconhece o texto para a conversa mostrar em quadradinhos; o texto em si é montado no app do
 * motorista (pricing/pickup-fee.ts e rides/arrival.ts) e precisa continuar igual. Testado em
 * scripts/driver-notices.test.ts.
 */

export type ParsedPickupMessage = { fee: string; km: string; total: string; ride: string };

export function parsePickupMessage(body: string | null | undefined): ParsedPickupMessage | null {
  const m = (body ?? "").match(
    /Estou indo até o ponto de embarque!\s*Deslocamento até você:\s*(R\$\s?[\d.,]+)\s*\(([\d.,]+)\s*km\)\.\s*Total da corrida:\s*(R\$\s?[\d.,]+)\s*\((R\$\s?[\d.,]+)\s*da corrida/,
  );
  return m ? { fee: m[1], km: m[2], total: m[3], ride: m[4] } : null;
}

export const ARRIVAL_PREFIX = "🚗 Cheguei ao local de embarque";

export function isArrivalMessage(body: string | null | undefined): boolean {
  return (body ?? "").trimStart().startsWith(ARRIVAL_PREFIX);
}

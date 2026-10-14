import type { ChatMessage } from "@/integrations/supabase/types";

/**
 * Regras de tempo da Agenda do passageiro (sem React, pra testar sozinho: scripts/agenda.test.ts).
 *
 * A corrida some da Agenda 1 DIA depois do horário dela (feita ou não), e 1 dia depois de cancelada.
 * Nada é apagado do banco: o que sai da Agenda fica no Histórico (uma lista pequena e recolhida no fim da página).
 */

/** Passou disso do horário, a corrida vai de "próximas" pra "Anteriores". */
export const PAST_AFTER_MS = 30 * 60_000;
/** Passou disso (do horário, ou de ter sido cancelada), a corrida sai da Agenda e vai pro Histórico. */
export const HIDE_AFTER_MS = 24 * 60 * 60_000;
/** Quantas linhas o Histórico mostra (as mais recentes). */
export const HISTORY_LIMIT = 50;

export type RideRequest = Pick<
  ChatMessage,
  "id" | "link_id" | "body" | "origin_label" | "destination_label" | "requested_at" | "created_at" | "ride_confirmed" | "is_ride_request"
> &
  Partial<Pick<ChatMessage, "cancelled_at" | "cancelled_by">>;

/** Horário da corrida (o que a pessoa pediu; pedido antigo sem horário usa a hora do pedido). */
export function rideTime(m: Pick<RideRequest, "requested_at" | "created_at">): number {
  return new Date(m.requested_at ?? m.created_at).getTime();
}

function cancelledTime(m: Pick<RideRequest, "cancelled_at">): number | null {
  if (!m.cancelled_at) return null;
  const t = new Date(m.cancelled_at).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Quando este pedido/corrida sai da Agenda e vai pro Histórico. */
export function hideAt(m: Pick<RideRequest, "requested_at" | "created_at" | "cancelled_at">): number {
  return (cancelledTime(m) ?? rideTime(m)) + HIDE_AFTER_MS;
}

export type AgendaSplit<T> = {
  /** Confirmadas que ainda vão acontecer (ou começaram há menos de 30 min), mais cedo primeiro. */
  upcoming: T[];
  /** Confirmadas que já passaram do horário, mas ainda não completaram 1 dia, mais recentes primeiro. */
  recent: T[];
  /** Confirmadas e depois canceladas, ainda dentro de 1 dia do cancelamento. */
  cancelled: T[];
  /** Tudo que já saiu da Agenda (qualquer situação), mais recentes primeiro. */
  history: T[];
};

export function splitAgenda<T extends RideRequest>(requests: T[], now: number): AgendaSplit<T> {
  const out: AgendaSplit<T> = { upcoming: [], recent: [], cancelled: [], history: [] };
  for (const m of requests) {
    if (!m.is_ride_request) continue;
    if (now >= hideAt(m)) {
      out.history.push(m);
      continue;
    }
    // Pedido que o motorista não aceitou (ou que o passageiro cancelou antes de aceitar) nunca esteve na Agenda.
    if (!m.ride_confirmed) continue;
    if (m.cancelled_at) out.cancelled.push(m);
    else if (rideTime(m) >= now - PAST_AFTER_MS) out.upcoming.push(m);
    else out.recent.push(m);
  }
  const byTime = (a: T, b: T) => rideTime(a) - rideTime(b);
  out.upcoming.sort(byTime);
  out.recent.sort((a, b) => byTime(b, a));
  out.cancelled.sort((a, b) => byTime(b, a));
  out.history.sort((a, b) => byTime(b, a));
  return out;
}

export type HistoryStatus = "cancelled_by_me" | "cancelled_by_driver" | "confirmed" | "unanswered";

/**
 * Situação de uma linha do Histórico. O passageiro não sabe se a corrida foi mesmo feita (quem
 * marca isso é o motorista), então "confirmada" quer dizer só que o motorista aceitou.
 */
export function historyStatus(m: Pick<RideRequest, "ride_confirmed" | "cancelled_at" | "cancelled_by">): HistoryStatus {
  if (m.cancelled_at) return m.cancelled_by === "driver" ? "cancelled_by_driver" : "cancelled_by_me";
  return m.ride_confirmed ? "confirmed" : "unanswered";
}

export const HISTORY_LABEL: Record<HistoryStatus, string> = {
  cancelled_by_me: "Cancelada por você",
  cancelled_by_driver: "Cancelada pelo motorista",
  confirmed: "Confirmada",
  unanswered: "Sem resposta",
};

/**
 * Compartilhar o motorista com um amigo (perfil do motorista no app do passageiro).
 *
 * O QR e o link levam à MESMA página de convite que o motorista já usa (`?p=CODIGO`, ver lib/invite.ts): quem
 * não tem o app é levado a baixar, e depois de instalar entra já com esse motorista. Aqui é só lógica pura
 * (sem React) para poder testar: scripts/share-driver.test.ts.
 */
import { buildInviteUrl, parseInviteCode } from "./invite";

/** Primeiro nome ("Maria da Silva" → "Maria"); sem nome vira "o motorista". */
export function driverFirstName(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first || "o motorista";
}

/** Link do convite (é o que vai dentro do QR). Null se o código não for válido. */
export function driverShareUrl(code: string | null | undefined): string | null {
  const valid = parseInviteCode(code ?? null);
  return valid ? buildInviteUrl(valid) : null;
}

/** Mensagem pronta para mandar por WhatsApp etc. */
export function driverShareMessage(name: string | null | undefined, url: string): string {
  const who = driverFirstName(name);
  const lead = who === "o motorista" ? "Conheça o meu motorista no Drivon" : `Conheça ${who}, meu motorista no Drivon`;
  return `${lead}! Toque no link, baixe o app e já entre com ele: ${url}`;
}

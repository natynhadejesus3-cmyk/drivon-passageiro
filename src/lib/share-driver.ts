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

/** Só os dígitos do telefone, já com o 55 do Brasil quando vier sem (10 ou 11 dígitos). Null se não parecer um telefone. */
export function phoneDigits(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

/** Link que abre a conversa no WhatsApp com o motorista. */
export function whatsappUrl(phone: string | null | undefined): string | null {
  const d = phoneDigits(phone);
  return d ? `https://wa.me/${d}` : null;
}

/** Link que abre a ligação. */
export function telUrl(phone: string | null | undefined): string | null {
  const d = phoneDigits(phone);
  return d ? `tel:+${d}` : null;
}

/** "(74) 99999-8888" para mostrar na tela; se não der para formatar, devolve como veio. */
export function formatPhone(phone: string | null | undefined): string {
  const d = phoneDigits(phone);
  if (!d) return (phone ?? "").trim();
  const local = d.slice(2);
  const ddd = local.slice(0, 2);
  const rest = local.slice(2);
  const cut = rest.length === 9 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, cut)}-${rest.slice(cut)}`;
}

/** Mensagem pronta para mandar por WhatsApp etc. */
export function driverShareMessage(name: string | null | undefined, url: string): string {
  const who = driverFirstName(name);
  const lead = who === "o motorista" ? "Conheça o meu motorista no Drivon" : `Conheça ${who}, meu motorista no Drivon`;
  return `${lead}! Toque no link, baixe o app e já entre com ele: ${url}`;
}

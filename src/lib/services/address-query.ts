// Preparo do texto digitado antes de buscar endereço. Funções puras (sem rede), para testar fácil.
// Mesmo arquivo nos dois apps (motorista e passageiro).

/** Sem acento, minúsculo, espaços simples. */
function plain(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Abreviações que só valem na PRIMEIRA palavra (tipo de via) — senão confundiriam com nomes reais. */
const STREET_TYPE: Record<string, string> = {
  r: "rua",
  av: "avenida",
  avda: "avenida",
  pc: "praça",
  pca: "praça",
  pça: "praça",
  pç: "praça",
  trav: "travessa",
  tv: "travessa",
  rod: "rodovia",
  est: "estrada",
  estr: "estrada",
  al: "alameda",
  lgo: "largo",
  jd: "jardim",
  vl: "vila",
  cj: "conjunto",
  conj: "conjunto",
  res: "residencial",
  lot: "loteamento",
};

/** Abreviações de títulos, válidas em qualquer posição. */
const TITLE: Record<string, string> = {
  dr: "doutor",
  dra: "doutora",
  prof: "professor",
  profa: "professora",
  cel: "coronel",
  gen: "general",
  pres: "presidente",
  eng: "engenheiro",
  sto: "santo",
  sta: "santa",
  ten: "tenente",
  cap: "capitão",
};

/** Siglas de estado/rodovia: o número depois delas faz parte do nome ("BR 116", "BA 262"). */
const ROAD_OR_UF =
  /^(br|ba|sp|mg|rj|pr|sc|rs|go|es|pe|ce|ma|pa|am|mt|ms|to|al|se|rn|pb|pi|ro|rr|ap|ac|df|rodovia|rod|estrada|est)$/;

/** "Av. Rio Branco nº 245" → "Avenida Rio Branco 245". Só expande abreviação conhecida. */
export function expandAbbreviations(q: string): string {
  const cleaned = q
    .replace(/\bs\s*\/\s*n\b/gi, " ")
    .replace(/\b(?:n[º°o]|num|numero|número)\.?\s*(?=\d)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ");
  const out = words.map((w, i) => {
    const bare = w.replace(/[.,;]+$/g, "");
    const trail = w.slice(bare.length).replace(/\./g, "");
    const key = plain(bare);
    const type = i === 0 ? STREET_TYPE[key] : undefined;
    if (type) return type.charAt(0).toUpperCase() + type.slice(1) + trail;
    const title = TITLE[key];
    return title ? title + trail : w;
  });
  return out.join(" ").replace(/\s+/g, " ").trim();
}

export type SplitAddress = { street: string; number: string | null };

/**
 * Separa o número da casa no fim ("Avenida Brasil, 150" → rua + 150).
 * Não separa quando o número é parte do nome: "Rua 15", "BR 116", "Rodovia BA 262".
 */
export function splitHouseNumber(q: string): SplitAddress {
  const t = q.trim();
  const m = t.match(/^(.*?[A-Za-zÀ-ÿ].*?)[,\s]+(\d{1,5}[A-Za-z]?)$/);
  if (!m) return { street: t, number: null };
  const street = m[1]!.replace(/[,\s]+$/g, "").trim();
  const words = plain(street).split(" ").filter(Boolean);
  if (words.length < 2) return { street: t, number: null };
  if (ROAD_OR_UF.test(words[words.length - 1]!)) return { street: t, number: null };
  return { street, number: m[2]! };
}

export type QueryPlan = {
  /** Texto principal para buscar (abreviações expandidas, com o número). */
  primary: string;
  /** Só a rua, sem o número — usado quando o mapa não conhece a numeração. */
  streetOnly: string | null;
  /** Número da casa digitado, se houver. */
  number: string | null;
  /** Texto "limpo" (sem número) para pontuar a relevância dos resultados. */
  scoreText: string;
};

export function planQuery(q: string): QueryPlan {
  const primary = expandAbbreviations(q);
  const { street, number } = splitHouseNumber(primary);
  return {
    primary,
    streetOnly: number ? street : null,
    number,
    scoreText: street,
  };
}

/** Põe o número digitado no resultado de rua (o ponto fica na rua; o texto mostra o número). */
export function attachNumber<T extends { street: string; label: string }>(
  item: T,
  number: string | null,
): T {
  if (!number) return item;
  if (/,\s*\d+[A-Za-z]?\s*$/.test(item.street)) return item; // já tem número
  const street = `${item.street}, ${number}`;
  const label = item.label.startsWith(item.street)
    ? `${street}${item.label.slice(item.street.length)}`
    : `${street}, ${item.label}`;
  return { ...item, street, label };
}

const ACCENT_CLASS: Record<string, string> = {
  a: "[aáàâãä]",
  e: "[eéèêë]",
  i: "[iíìîï]",
  o: "[oóòôõö]",
  u: "[uúùûü]",
  c: "[cç]",
};

/** Trecho de regex que casa o mesmo texto com ou sem acento (o Overpass não ignora acento). */
export function accentPattern(token: string): string {
  let out = "";
  for (const ch of plain(token)) {
    if (ACCENT_CLASS[ch]) out += ACCENT_CLASS[ch];
    else out += ch.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&");
  }
  return out;
}

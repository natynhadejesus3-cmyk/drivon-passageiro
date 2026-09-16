// Overpass — busca direta de POIs (node/way/relation) do OpenStreetMap pelo nome.
import type { AddressSuggestion } from "./address-search-service";

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Categorias genéricas → tags OSM, para buscas como "farmácia", "posto". */
const CATEGORIES: Record<string, string[]> = {
  hospital: ["amenity=hospital", "amenity=clinic"],
  hospitais: ["amenity=hospital"],
  clinica: ["amenity=clinic", "amenity=doctors"],
  clinicas: ["amenity=clinic", "amenity=doctors"],
  farmacia: ["amenity=pharmacy"],
  farmacias: ["amenity=pharmacy"],
  posto: ["amenity=fuel"],
  postos: ["amenity=fuel"],
  supermercado: ["shop=supermarket"],
  supermercados: ["shop=supermarket"],
  mercado: ["shop=supermarket", "shop=convenience"],
  restaurante: ["amenity=restaurant"],
  restaurantes: ["amenity=restaurant"],
  lanchonete: ["amenity=fast_food"],
  hotel: ["tourism=hotel"],
  hoteis: ["tourism=hotel"],
  pousada: ["tourism=guest_house"],
  escola: ["amenity=school"],
  escolas: ["amenity=school"],
  faculdade: ["amenity=college", "amenity=university"],
  banco: ["amenity=bank"],
  bancos: ["amenity=bank"],
  praca: ["leisure=park", "leisure=garden"],
  pracas: ["leisure=park"],
  shopping: ["shop=mall"],
  loja: ["shop"],
  lojas: ["shop"],
  padaria: ["shop=bakery"],
  igreja: ["amenity=place_of_worship"],
  academia: ["leisure=fitness_centre"],
};

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&");
}

/** true quando o texto é uma categoria genérica ("farmácia", "posto", "hospital"). */
export function isCategoryQuery(q: string): boolean {
  return !!CATEGORIES[normalizeText(q)];
}

function buildQuery(q: string, lat: number, lng: number, radius: number): string {
  const nq = normalizeText(q);
  const cat = CATEGORIES[nq];
  const around = `(around:${radius},${lat},${lng})`;
  const parts: string[] = [];
  if (cat) {
    for (const tag of cat) {
      const [k, v] = tag.split("=");
      const filter = v ? `["${k}"="${v}"]` : `["${k}"]`;
      // nwr = node + way + relation
      parts.push(`nwr${filter}${around};`);
    }
  } else {
    // Correspondência parcial e tolerante: "Hospital Prado Valadares"
    // encontra "Hospital Geral Prado Valadares".
    const re = q
      .trim()
      .split(/\s+/)
      .map((t) => esc(t))
      .join(".*");
    for (const key of ["name", "official_name", "alt_name", "short_name", "brand", "operator"]) {
      parts.push(`nwr["${key}"~"${re}",i]${around};`);
    }
  }
  return `[out:json][timeout:15];(${parts.join("")});out center tags 40;`;
}

function toSuggestion(el: any): AddressSuggestion | null {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const t = el.tags ?? {};
  const name: string = t.name ?? t.official_name ?? t.brand ?? t.operator ?? "";
  if (!name) return null;
  const street = t["addr:street"]
    ? `${t["addr:street"]}${t["addr:housenumber"] ? ", " + t["addr:housenumber"] : ""}`
    : "";
  const city: string = t["addr:city"] ?? "";
  const state: string = t["addr:state"] ?? "";
  const location = [city, state].filter(Boolean).join(" - ");
  return {
    id: `ovp-${el.type}-${el.id}`,
    label: [name, street, location].filter(Boolean).join(", "),
    street: name,
    city,
    state,
    country: "Brasil",
    lat,
    lng,
    type: "poi",
    source: "overpass",
  };
}

export type OverpassOptions = {
  signal?: AbortSignal;
  bias: { lat: number; lng: number };
  radius?: number;
  timeoutMs?: number;
};

export async function searchOverpass(
  query: string,
  opts: OverpassOptions,
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const radius = opts.radius ?? 30000;
  const body = buildQuery(q, opts.bias.lat, opts.bias.lng, radius);
  const timeoutMs = opts.timeoutMs ?? 7000;

  for (const url of ENDPOINTS) {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    opts.signal?.addEventListener("abort", onAbort);
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(body)}`,
      });
      if (!res.ok) continue;
      const json = await res.json();
      const els: any[] = Array.isArray(json?.elements) ? json.elements : [];
      return els.map(toSuggestion).filter((x): x is AddressSuggestion => !!x);
    } catch {
      if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      // tenta próximo endpoint
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    }
  }
  return [];
}

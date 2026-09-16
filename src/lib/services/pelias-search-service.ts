// GeoSearch — Pelias (principal) → Nominatim POI → Photon (fallback)
// Todos os provedores retornam o mesmo formato AddressSuggestion.
import { AddressSearchService, type AddressSuggestion } from "./address-search-service";
import { searchOverpass, normalizeText, isCategoryQuery } from "./overpass-poi-service";

export type { AddressSuggestion };

export type GeoSearchOptions = {
  signal?: AbortSignal;
  limit?: number;
  bias?: { lat: number; lng: number } | null;
  /** Chamado assim que o primeiro lote de sugestões chega (resultado parcial). */
  onPartial?: (items: AddressSuggestion[]) => void;
};

/** Aborta uma etapa lenta sem derrubar a busca inteira. */
function withTimeout(ms: number, signal?: AbortSignal): AbortSignal {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  // limpa o timer quando terminar
  ctrl.signal.addEventListener("abort", () => clearTimeout(t), { once: true });
  return ctrl.signal;
}


/** Instâncias públicas de Pelias tentadas em ordem. A primeira que responder é memorizada. */
const PELIAS_ENDPOINTS = [
  import.meta.env["VITE_PELIAS_URL"] as string | undefined,
  "https://pelias.cvut.cz/v1",
  "https://api.geocode.earth/v1",
].filter(Boolean) as string[];

const PELIAS_KEY = (import.meta.env["VITE_PELIAS_API_KEY"] as string | undefined) ?? "";

let peliasBase: string | null | undefined; // undefined = não testado, null = indisponível

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function makeId(prefix: string, lat: number, lng: number, name: string) {
  return `${prefix}-${lat.toFixed(5)}-${lng.toFixed(5)}-${name.slice(0, 24)}`;
}

function compose(
  prefix: string,
  name: string,
  street: string,
  city: string,
  state: string,
  country: string,
  lat: number,
  lng: number,
): AddressSuggestion {
  const primary = name || street || [city, state].filter(Boolean).join(", ");
  const location = [city, state].filter(Boolean).join(" - ");
  const label = [primary, street && street !== primary ? street : "", location, country]
    .filter(Boolean)
    .join(", ");
  return {
    id: makeId(prefix, lat, lng, primary),
    label,
    street: primary,
    city,
    state,
    country,
    lat,
    lng,
  };
}

// ---------------------------------------------------------------- Pelias
async function peliasQuery(base: string, q: string, opts: GeoSearchOptions) {
  const params = new URLSearchParams({ text: q, size: String(opts.limit ?? 8) });
  if (PELIAS_KEY) params.set("api_key", PELIAS_KEY);
  if (opts.bias) {
    params.set("focus.point.lat", String(opts.bias.lat));
    params.set("focus.point.lon", String(opts.bias.lng));
  }
  const res = await fetch(`${base}/autocomplete?${params}`, {
    signal: opts.signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Pelias HTTP ${res.status}`);
  const json = await res.json();
  const feats: any[] = Array.isArray(json?.features) ? json.features : [];
  return feats
    .map((f) => {
      const lng = num(f?.geometry?.coordinates?.[0]);
      const lat = num(f?.geometry?.coordinates?.[1]);
      if (lat === null || lng === null) return null;
      const p = f.properties ?? {};
      const street = p.street
        ? `${p.street}${p.housenumber ? ", " + p.housenumber : ""}`
        : (p.street ?? "");
      return compose(
        "pel",
        p.name ?? "",
        street,
        p.locality ?? p.localadmin ?? p.county ?? "",
        p.region_a ?? p.region ?? "",
        p.country ?? "",
        lat,
        lng,
      );
    })
    .filter((x): x is AddressSuggestion => !!x);
}

async function searchPelias(q: string, opts: GeoSearchOptions): Promise<AddressSuggestion[]> {
  if (peliasBase === null) return [];
  if (peliasBase) return peliasQuery(peliasBase, q, opts);
  for (const base of PELIAS_ENDPOINTS) {
    try {
      const r = await peliasQuery(base, q, opts);
      peliasBase = base;
      return r;
    } catch (e: any) {
      if (e?.name === "AbortError") throw e;
    }
  }
  peliasBase = null; // nenhuma instância pública respondeu — usa fallbacks
  return [];
}

// ------------------------------------------------------------- Nominatim
async function searchNominatim(
  q: string,
  opts: GeoSearchOptions,
  bounded = false,
): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "br",
    limit: String(opts.limit ?? 8),
    q,
  });
  if (opts.bias) {
    const { lat, lng } = opts.bias;
    const d = bounded ? 0.35 : 0.6; // ~35 km (restrito) / ~65 km (viés)
    params.set("viewbox", `${lng - d},${lat - d},${lng + d},${lat + d}`);
    if (bounded) params.set("bounded", "1");
  } else if (bounded) {
    return [];
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    signal: opts.signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const json = await res.json();
  const rows: any[] = Array.isArray(json) ? json : [];
  return rows
    .map((r) => {
      const lat = num(parseFloat(r.lat));
      const lng = num(parseFloat(r.lon));
      if (lat === null || lng === null) return null;
      const a = r.address ?? {};
      const street = a.road ? `${a.road}${a.house_number ? ", " + a.house_number : ""}` : "";
      const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "";
      return compose("nom", r.name ?? "", street, city, a.state ?? "", a.country ?? "", lat, lng);
    })
    .filter((x): x is AddressSuggestion => !!x);
}

// ----------------------------------------------------- dedupe / relevância
function norm(s: string) {
  return normalizeText(s);
}

function dedupe(items: AddressSuggestion[]): AddressSuggestion[] {
  const out: AddressSuggestion[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const byName = `${norm(it.street)}|${norm(it.city)}`;
    const byGeo = `${it.lat.toFixed(3)}|${it.lng.toFixed(3)}|${norm(it.street).slice(0, 12)}`;
    if (seen.has(byName) || seen.has(byGeo)) continue;
    seen.add(byName);
    seen.add(byGeo);
    out.push(it);
  }
  return out;
}

function distMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function tokens(s: string) {
  return norm(s).split(" ").filter((t: string) => t.length > 2);
}

// Quando nenhum provedor acha o nome da rua/local, compose() cai pra só
// "cidade, estado" — um resultado vago que parece confiante mas não diz o
// endereço de verdade. Detecta esse caso pra não deixar ele disputar o topo
// da lista com um endereço mais completo de outro provedor.
function isCityOnly(it: AddressSuggestion): boolean {
  const cityState = [it.city, it.state].filter(Boolean).join(", ");
  return !!cityState && norm(it.street) === norm(cityState);
}

const STREET_HINT_RE = /\b(rua|av|avenida|alameda|al|travessa|rodovia|estrada|praça|pca|largo|via)\b\.?/i;

/** A pessoa parece estar buscando um endereço específico (não só uma cidade). */
function looksLikeSpecificAddress(q: string): boolean {
  return /\d/.test(q) || STREET_HINT_RE.test(q);
}

function score(it: AddressSuggestion, q: string, bias?: { lat: number; lng: number } | null) {
  const nq = norm(q);
  const name = norm(it.street);
  let s = 0;
  if (name === nq) s += 100;
  else if (name.startsWith(nq)) s += 70;
  else if (name.includes(nq)) s += 50;
  const qt = tokens(q);
  if (qt.length) {
    const hit = qt.filter((t: string) => name.includes(t)).length;
    s += (hit / qt.length) * 40;
  }
  if (it.type === "poi") s += 20;
  if (it.source === "overpass") s += 10;
  if (looksLikeSpecificAddress(q) && isCityOnly(it)) s -= 80;
  if (bias) {
    const d = distMeters(bias, it);
    it.distanceMeters = Math.round(d);
    // Proximidade domina: local sempre antes de outra cidade/estado.
    s += 120 * Math.exp(-d / 25000);
    if (d > 150000) s -= 60;
    if (d > 600000) s -= 60;
  }
  it.relevanceScore = s;
  return s;
}

function rank(items: AddressSuggestion[], q: string, bias?: { lat: number; lng: number } | null) {
  return [...items].sort((a, b) => score(b, q, bias) - score(a, q, bias));
}

function tag(
  items: AddressSuggestion[],
  source: AddressSuggestion["source"],
  type: AddressSuggestion["type"],
) {
  return items.map((i) => ({ ...i, source: i.source ?? source, type: i.type ?? type }));
}

// -------------------------------------------------- cache temporário (leve)
type CacheEntry = { at: number; items: AddressSuggestion[] };
const CACHE_TTL = 5 * 60_000;
const CACHE_MAX = 40;
const cache = new Map<string, CacheEntry>();

function cacheKey(q: string, limit: number, bias?: { lat: number; lng: number } | null) {
  const b = bias ? `${bias.lat.toFixed(2)},${bias.lng.toFixed(2)}` : "-";
  return `${normalizeText(q)}|${limit}|${b}`;
}

function cacheGet(key: string): AddressSuggestion[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, hit); // LRU refresh
  return hit.items;
}

function cacheSet(key: string, items: AddressSuggestion[]) {
  cache.set(key, { at: Date.now(), items });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

export const GeoSearchService = {
  /** Rápido primeiro (Nominatim + Photon em paralelo), depois reforços. */
  async search(query: string, opts: GeoSearchOptions = {}): Promise<AddressSuggestion[]> {
    const q = query.trim();

    if (q.length < 3) return [];
    const limit = opts.limit ?? 8;
    const bias = opts.bias ?? null;
    const key = cacheKey(q, limit, bias);
    const cached = cacheGet(key);
    if (cached) {
      opts.onPartial?.(cached);
      return cached;
    }

    const userSignal = opts.signal;
    const aborted = () => !!userSignal?.aborted;
    /** Nunca deixa uma etapa lenta derrubar a busca (só o abort do usuário). */
    const soft = async (p: Promise<AddressSuggestion[]>) => {
      try {
        return await p;
      } catch (e: any) {
        if (aborted()) throw e;
        return [] as AddressSuggestion[];
      }
    };

    const acc: AddressSuggestion[] = [];
    const shape = (items: AddressSuggestion[]) => rank(dedupe(items), q, bias).slice(0, limit);
    const finish = (items: AddressSuggestion[]) => {
      const out = shape(items);
      cacheSet(key, out);
      return out;
    };

    // 1) Etapa rápida — Nominatim (região atual) + Photon em paralelo. Cada
    // um atualiza a lista assim que responder (não espera o outro), para o
    // primeiro resultado aparecer o quanto antes na tela.
    const fast = { ...opts, signal: withTimeout(2500, userSignal) };
    const nomP = soft(searchNominatim(q, fast, !!bias)).then((r) => {
      acc.push(...tag(r, "nominatim", "address"));
      if (r.length) opts.onPartial?.(shape(acc));
      return r;
    });
    const phoP = soft(AddressSearchService.search(q, { signal: fast.signal, limit, bias })).then((r) => {
      acc.push(...tag(r, "photon", "address"));
      if (r.length) opts.onPartial?.(shape(acc));
      return r;
    });
    await Promise.all([nomP, phoP]);
    if (dedupe(acc).length >= limit) return finish(acc);

    if (aborted()) return shape(acc);

    // 2) Overpass — categorias ("farmácia", "posto") direto no OSM.
    if (bias && isCategoryQuery(q)) {
      const pois = await soft(
        searchOverpass(q, { signal: withTimeout(5000, userSignal), bias, radius: 25000, timeoutMs: 5000 }),
      );
      if (pois.length) {
        acc.push(...pois);
        opts.onPartial?.(shape(acc));
        if (dedupe(acc).length >= limit) return finish(acc);
      }
    }

    // 3) Overpass por nome quando o índice não achou o estabelecimento.
    // Timeout curto: é um reforço, não pode segurar a lista por muito tempo.
    if (bias && !isCategoryQuery(q) && dedupe(acc).length < 2) {
      const byName = await soft(
        searchOverpass(q, { signal: withTimeout(2500, userSignal), bias, radius: 25000, timeoutMs: 2500 }),
      );
      if (byName.length) {
        acc.push(...byName);
        opts.onPartial?.(shape(acc));
        if (dedupe(acc).length >= limit) return finish(acc);
      }
    }

    // 4) Pelias + Nominatim amplo — reforço final, também com orçamento curto.
    const slow = { ...opts, signal: withTimeout(3000, userSignal) };
    const [pel, nomWide] = await Promise.all([
      soft(searchPelias(q, slow)),
      bias ? soft(searchNominatim(q, { ...slow, bias: null })) : Promise.resolve([] as AddressSuggestion[]),
    ]);
    acc.push(...tag(pel, "pelias", "address"), ...tag(nomWide, "nominatim", "address"));

    return finish(acc);
  },
};

// AddressSearchService — Photon (OpenStreetMap) autocomplete
// Docs: https://photon.komoot.io

export type AddressSuggestion = {
  id: string;
  label: string; // full readable address (street, city, state)
  street: string; // street/name line
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  type?: "poi" | "address" | "street" | "place";
  source?: "overpass" | "nominatim" | "pelias" | "photon";
  distanceMeters?: number;
  relevanceScore?: number;
};

const ENDPOINT = "https://photon.komoot.io/api";

function formatSuggestion(feature: any, idx: number): AddressSuggestion | null {
  const [lng, lat] = feature?.geometry?.coordinates ?? [];
  const p = feature?.properties ?? {};
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const name: string = p.name ?? "";
  const street: string = p.street
    ? `${p.street}${p.housenumber ? ", " + p.housenumber : ""}`
    : name;
  const city: string = p.city ?? p.town ?? p.village ?? p.municipality ?? p.county ?? "";
  const state: string = p.state ?? "";
  const country: string = p.country ?? "";

  // Prioriza o nome do POI/estabelecimento quando existir.
  const primary = name || street || [city, state].filter(Boolean).join(", ");
  const secondary = street && street !== primary ? street : "";
  const location = [city, state].filter(Boolean).join(" - ");
  const label = [primary, secondary, location, country].filter(Boolean).join(", ");

  return {
    id: `${p.osm_type ?? "n"}${p.osm_id ?? idx}-${lat.toFixed(5)}-${lng.toFixed(5)}`,
    label,
    street: primary,
    city,
    state,
    country,
    lat,
    lng,
  };
}

export type SearchOptions = {
  signal?: AbortSignal;
  limit?: number;
  lang?: string;
  bias?: { lat: number; lng: number } | null;
};

export const AddressSearchService = {
  async search(query: string, opts: SearchOptions = {}): Promise<AddressSuggestion[]> {
    const q = query.trim();
    if (q.length < 3) return [];
    // Photon supported langs: default, de, en, fr. "pt" retorna HTTP 400.
    const rawLang = opts.lang ?? "default";
    const lang = ["default", "de", "en", "fr"].includes(rawLang) ? rawLang : "default";
    const params = new URLSearchParams({
      q,
      limit: String(opts.limit ?? 6),
      lang,
    });
    if (opts.bias) {
      params.set("lat", String(opts.bias.lat));
      params.set("lon", String(opts.bias.lng));
    }
    const url = `${ENDPOINT}?${params.toString()}`;
    let res: Response;
    try {
      res = await fetch(url, { signal: opts.signal, headers: { Accept: "application/json" } });
    } catch (e) {
      console.error("[AddressSearch] network error", { url, error: e });
      throw e;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[AddressSearch] HTTP error", { url, status: res.status, body });
      throw new Error(`Photon HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    const feats: any[] = Array.isArray(json?.features) ? json.features : [];
    return feats
      .map((f, i) => formatSuggestion(f, i))
      .filter((x): x is AddressSuggestion => !!x);
  },
};

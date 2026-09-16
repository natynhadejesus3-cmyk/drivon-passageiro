import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import type { AddressSuggestion } from "./address-search-service";

export type LocationCoords = {
  lat: number;
  lng: number;
  accuracy: number;
};

export type LocationContext = LocationCoords & {
  city?: string;
  state?: string;
  source: "gps" | "ip";
};

/**
 * GPS puro. Dentro do WebView do Android, isso só funciona se a permissão
 * nativa (ACCESS_FINE_LOCATION/ACCESS_COARSE_LOCATION) já tiver sido
 * concedida — por isso pedimos explicitamente antes de chamar getCurrentPosition,
 * em vez de confiar no prompt automático do WebView (que não dispara sem isso).
 */
export async function getCurrentPosition(): Promise<LocationCoords> {
  if (Capacitor.isNativePlatform()) {
    const perm = await Geolocation.requestPermissions({ permissions: ["location"] });
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
      throw new Error("Permissão de localização negada");
    }
  }
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10_000 });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
}

type ReverseResult = {
  city?: string;
  state?: string;
  street?: string;
  country?: string;
};

async function reverseLookup(lat: number, lng: number): Promise<ReverseResult> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&zoom=18`,
      { headers: { "Accept-Language": "pt-BR" } },
    );
    const j = await r.json();
    const a = j.address ?? {};
    return {
      street: a.road ? `${a.road}${a.house_number ? ", " + a.house_number : ""}` : undefined,
      city: a.city ?? a.town ?? a.village ?? a.municipality ?? a.county,
      state: a.state,
      country: a.country,
    };
  } catch {
    return {};
  }
}

/** Cidade/estado do ponto — usado pra dar bônus de "mesma cidade" na busca. */
export async function reverseGeocode(lat: number, lng: number): Promise<{ city?: string; state?: string }> {
  const { city, state } = await reverseLookup(lat, lng);
  return { city, state };
}

/** Endereço completo (rua, cidade, estado) formatado pra preencher a origem automaticamente. */
export async function reverseGeocodeAddress(lat: number, lng: number): Promise<AddressSuggestion | null> {
  const { street, city, state, country } = await reverseLookup(lat, lng);
  if (!street && !city) return null;
  const primary = street || [city, state].filter(Boolean).join(", ");
  const location = [city, state].filter(Boolean).join(" - ");
  const label = [primary, location, country].filter(Boolean).join(", ");
  return {
    id: `rev-${lat.toFixed(5)}-${lng.toFixed(5)}`,
    label,
    street: primary,
    city: city ?? "",
    state: state ?? "",
    country: country ?? "",
    lat,
    lng,
  };
}

/** Sinal aproximado (nível de cidade, via IP) quando o GPS falha ou é negado. */
async function getApproxLocationByIP(): Promise<LocationContext | null> {
  try {
    const r = await fetch("https://ipapi.co/json/");
    if (!r.ok) return null;
    const j = await r.json();
    if (typeof j.latitude !== "number" || typeof j.longitude !== "number") return null;
    return {
      lat: j.latitude,
      lng: j.longitude,
      accuracy: 50_000,
      city: j.city || undefined,
      state: j.region || undefined,
      source: "ip",
    };
  } catch {
    return null;
  }
}

/**
 * GPS primeiro (com cidade/estado via reverse geocode); se falhar ou for
 * negado, cai pra localização aproximada por IP. Nunca lança — na pior das
 * hipóteses devolve null e a busca segue sem viés geográfico.
 */
export async function resolveLocationContext(): Promise<LocationContext | null> {
  try {
    const gps = await getCurrentPosition();
    const { city, state } = await reverseGeocode(gps.lat, gps.lng);
    return { ...gps, city, state, source: "gps" };
  } catch {
    return getApproxLocationByIP();
  }
}

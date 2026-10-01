// Mesmo servico publico OSRM ja usado no app do motorista (routing.ts) --
// so a distancia real de carro importa aqui, pra estimar o valor da corrida
// com a tarifa por km do motorista pareado.
export type GeoPoint = { lat: number; lng: number };

export type RouteResult = {
  distance_km: number;
  duration_min: number;
};

export async function routeDistance(a: GeoPoint, b: GeoPoint): Promise<RouteResult> {
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`;
  const r = await fetch(url);
  const j = await r.json();
  const rt = j.routes?.[0];
  if (!rt) throw new Error("Rota não encontrada");
  return { distance_km: rt.distance / 1000, duration_min: rt.duration / 60 };
}

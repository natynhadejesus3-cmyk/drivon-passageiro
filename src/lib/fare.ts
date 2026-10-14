/**
 * Valor estimado da corrida = distância (km) x preço por km do motorista, arredondado em centavos.
 *
 * É a MESMA conta do motor central do app do motorista (src/lib/pricing/fare-calculator.ts do Drivon:
 * round2 com Number.EPSILON). Tem que continuar idêntica, senão motorista e passageiro veem valores
 * diferentes (centavo de diferença já conta). Teste com valores de referência: scripts/fare.test.ts.
 */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function rideFare(distanceKm: number, pricePerKm: number): number {
  const km = Number.isFinite(distanceKm) ? Math.max(0, distanceKm) : 0;
  const rate = Number.isFinite(pricePerKm) ? Math.max(0, pricePerKm) : 0;
  return round2(km * rate);
}

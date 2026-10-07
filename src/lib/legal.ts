/**
 * Os textos legais (Política de Privacidade e Termos de Uso) moram no site do app do motorista e
 * valem para os DOIS apps. Os endereços abaixo são os mesmos que vão na ficha do app nas lojas.
 * Se o endereço do app do motorista mudar, mude aqui também (e em lib/legal/company.ts de lá).
 */
const BASE = "https://natynhadejesus3-cmyk-comfort-code-cave.canalgringo028.workers.dev";

export const LEGAL_URLS = {
  terms: `${BASE}/termos`,
  privacy: `${BASE}/privacidade`,
} as const;

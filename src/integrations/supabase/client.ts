import { createClient } from "@supabase/supabase-js";
import { getBootAuthLink } from "@/lib/recovery";
import type { Database } from "./types";

// Anota se o app abriu por um link de "esqueci minha senha" ANTES de o cliente abaixo ler (e
// limpar) o endereço. Sem isso o passageiro entraria direto no app, sem trocar a senha.
getBootAuthLink();

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Check drivon-passenger/.env.",
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

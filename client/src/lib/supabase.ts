import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase: SupabaseClient | null = supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        // A sessão permanece apenas enquanto a aba estiver aberta; cada nova abertura exige login.
        persistSession: false,
        autoRefreshToken: true,
        // O link de confirmação apenas confirma o e-mail; não abre o cockpit automaticamente.
        detectSessionInUrl: false,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error("Autenticação indisponível: VITE_SUPABASE_PUBLISHABLE_KEY não configurada.");
  }
  return supabase;
}

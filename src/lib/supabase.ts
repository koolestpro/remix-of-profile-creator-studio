import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public config — safe to expose in the browser. Row Level Security is the
// real protection. Define these in .env.local (see .env.example).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * True once the Supabase keys are present. Until then the app runs in its
 * pre-backend state (no auth gate, local data) so nothing breaks while you
 * set the project up.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * The Supabase client, or null when not yet configured. Always null-check
 * (or use `requireSupabase()`).
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.",
    );
  }
  return supabase;
}

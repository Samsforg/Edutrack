import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec le service role (type libre, comme le client ssr du
 * reste du code). À utiliser UNIQUEMENT côté serveur (webhooks, jobs,
 * actions d'admin), JAMAIS dans des composants client ou exposé au navigateur.
 */
let cached: SupabaseClientLike | null = null;

export function createAdminClient(): SupabaseClientLike {
  if (!cached) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      throw new Error(
        "Supabase admin env variables missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)."
      );
    }
    cached = createSupabaseClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cached;
}

/**
 * Le client admin est utilisé côté serveur pour bypasser la RLS.
 * La générique `GenericSchema` de supabase-js étant trop stricte pour nos
 * tables, on l'alias en type libre (comme le client ssr du reste du code).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseClientLike = any;

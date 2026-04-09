import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using service role key.
 * Use this in API routes — never expose on the client.
 *
 * Lazy-initialized to avoid build-time errors when env vars
 * are not available (Netlify evaluates API routes during build).
 */
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    _client = createClient(url, key);
  }
  return _client;
}

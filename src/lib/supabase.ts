import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using service role key.
 * Use this in API routes — never expose on the client.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

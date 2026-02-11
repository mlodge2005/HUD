import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client with service role key. Use only in API routes or server code.
 * Never expose SUPABASE_SERVICE_ROLE_KEY to the client.
 */
export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceRoleKey);
}

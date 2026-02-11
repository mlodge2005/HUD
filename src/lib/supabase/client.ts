"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client. Uses anon key only; never use service role here.
 * For Realtime (presence + broadcast) on /hud chat.
 */
export function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(url, anonKey);
}

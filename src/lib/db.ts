import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Server-only Supabase client using the service role key. Never import from client components. */
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export async function getSyncState(source: string) {
  const { data } = await db().from("sync_state").select("*").eq("source", source).maybeSingle();
  return data as
    | { source: string; cursor: string | null; full_scan_page: string | null; full_scan_done: boolean; stats: Record<string, number> }
    | null;
}

export async function setSyncState(source: string, patch: Record<string, unknown>) {
  await db().from("sync_state").upsert({ source, ...patch, updated_at: new Date().toISOString() });
}

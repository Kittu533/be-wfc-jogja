import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import { HttpError } from "../utils/http-error";
import type { SupabaseDatabase } from "../types/supabase";

let client: SupabaseClient<SupabaseDatabase> | null = null;

export function getSupabaseAdmin() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new HttpError(
      500,
      "Supabase env belum diset. Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  client ??= createClient<SupabaseDatabase>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return client;
}

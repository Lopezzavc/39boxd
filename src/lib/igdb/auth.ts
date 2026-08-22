import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

let memoryToken: { access_token: string; expires_at: number } | null = null;
let inFlight: Promise<string> | null = null;

async function fetchAndCacheToken(): Promise<string> {
  const { data: cached } = await supabase
    .from("igdb_token_cache")
    .select("access_token, expires_at")
    .eq("id", 1)
    .maybeSingle();

  if (cached && cached.expires_at > Date.now()) {
    memoryToken = cached;
    return cached.access_token;
  }

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );

  if (!res.ok) {
    throw new Error(`Twitch auth failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  const expires_at = Date.now() + data.expires_in * 1000 - 60_000;

  await supabase
    .from("igdb_token_cache")
    .upsert({ id: 1, access_token: data.access_token, expires_at });

  memoryToken = { access_token: data.access_token, expires_at };
  return data.access_token;
}

export async function getTwitchToken(): Promise<string> {
  if (memoryToken && memoryToken.expires_at > Date.now()) {
    return memoryToken.access_token;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = fetchAndCacheToken().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
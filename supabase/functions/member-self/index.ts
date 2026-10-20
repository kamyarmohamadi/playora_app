import { createClient } from "@supabase/supabase-js";

const headersFor = (origin: string | null, allowed: Set<string>) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "600",
  };
  if (origin && allowed.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
};

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request: Request) => {
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const configuredOrigins = (Deno.env.get("PLAYORA_ALLOWED_ORIGINS") ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const allowedOrigins = new Set(configuredOrigins);
  const origin = request.headers.get("origin");
  const headers = headersFor(origin, allowedOrigins);

  if (!projectUrl || !publishableKey) {
    return json({ error: "Service configuration is incomplete." }, 503, headers);
  }
  if (origin && !allowedOrigins.has(origin)) {
    return json({ error: "Origin is not allowed." }, 403, headers);
  }
  if (request.method === "OPTIONS") {
    if (!origin || !allowedOrigins.has(origin)) {
      return json({ error: "Origin is not allowed." }, 403, headers);
    }
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405, { ...headers, Allow: "GET, OPTIONS" });
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ") || authorization.length > 8200) {
    return json({ error: "Authentication is required." }, 401, headers);
  }
  const token = authorization.slice("Bearer ".length).trim();
  if (!token || token.length > 8100) {
    return json({ error: "Authentication is required." }, 401, headers);
  }

  // This function deliberately uses the publishable/anon key + the caller JWT.
  // It does not use the service-role key; database RLS remains in force.
  const userClient = createClient(projectUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: "Bearer " + token } },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) {
    return json({ error: "Session is invalid or expired." }, 401, headers);
  }
  const userId = authData.user.id;

  const [profileResult, walletResult, ledgerResult] = await Promise.all([
    userClient.from("member_profiles")
      .select("user_id, username, display_name, avatar_key, locale, created_at")
      .eq("user_id", userId).maybeSingle(),
    userClient.from("coin_wallets")
      .select("free_coins, purchased_coins, reward_coins, updated_at")
      .eq("user_id", userId).maybeSingle(),
    userClient.from("coin_ledger")
      .select("id, amount, bucket, event_type, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
  ]);

  if (profileResult.error || walletResult.error || ledgerResult.error) {
    // Do not send raw database errors or query details to the browser.
    return json({ error: "Member data could not be loaded." }, 503, headers);
  }
  if (!profileResult.data || !walletResult.data) {
    return json({ error: "Member records are not initialized." }, 409, headers);
  }

  return json({
    member: profileResult.data,
    wallet: walletResult.data,
    recentLedger: ledgerResult.data ?? [],
  }, 200, headers);
});

import { createClient } from "@supabase/supabase-js";

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers });

async function readBodyWithLimit(request: Request, limit: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function decodeVerifiedPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload || payload.length > 16_384) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(normalized), character => character.charCodeAt(0));
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return value && typeof value === "object" ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "600",
  };

  const projectUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const origins = (Deno.env.get("PLAYORA_ALLOWED_ORIGINS") ?? "")
    .split(",").map(value => value.trim()).filter(Boolean);
  const allowedOrigins = new Set(origins);
  const origin = request.headers.get("origin");

  if (origin) {
    if (!allowedOrigins.has(origin)) return json({ error: "Origin is not allowed." }, 403, headers);
    headers["Access-Control-Allow-Origin"] = origin;
  }
  if (request.method === "OPTIONS") {
    if (!origin || !allowedOrigins.has(origin)) return json({ error: "Origin is not allowed." }, 403, headers);
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { ...headers, Allow: "POST, OPTIONS" });
  }
  if (!projectUrl || !publishableKey || !serviceRoleKey) {
    return json({ error: "Account deletion is not configured." }, 503, headers);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 2_048) {
    return json({ error: "Request is too large." }, 413, headers);
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ") || authorization.length > 8_200) {
    return json({ error: "Authentication is required." }, 401, headers);
  }
  const token = authorization.slice("Bearer ".length).trim();
  if (!token || token.length > 8_100) return json({ error: "Authentication is required." }, 401, headers);

  let body: unknown;
  try {
    const rawBody = await readBodyWithLimit(request, 2_048);
    if (rawBody === null) return json({ error: "Request is too large." }, 413, headers);
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid request." }, 400, headers);
  }
  if (!body || typeof body !== "object" || (body as { confirmation?: unknown }).confirmation !== "DELETE") {
    return json({ error: "Explicit deletion confirmation is required." }, 400, headers);
  }

  // Validate the bearer token with Supabase before trusting any token claims.
  const callerClient = createClient(projectUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: "Bearer " + token } },
  });
  const { data: authData, error: authError } = await callerClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Session is invalid or expired." }, 401, headers);

  // Account deletion requires recent authentication to reduce session-theft risk.
  const claims = decodeVerifiedPayload(token);
  const authTime = typeof claims?.auth_time === "number" ? claims.auth_time : null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (authTime === null || authTime > nowSeconds + 60 || nowSeconds - authTime > 600) {
    return json({ error: "For account deletion, sign out and sign in again, then retry." }, 403, headers);
  }

  // The service-role key is used only here on the server. It must never be
  // returned to the browser or placed in a VITE_ variable.
  const adminClient = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { error: cleanupError } = await adminClient.rpc("prepare_account_deletion", {
    p_user_id: authData.user.id,
  });
  if (cleanupError) {
    return json({ error: "Account cleanup could not be completed. Your account was not deleted." }, 503, headers);
  }

  const { error: deletionError } = await adminClient.auth.admin.deleteUser(authData.user.id);
  if (deletionError) {
    return json({ error: "Account deletion could not be completed. Please retry or contact support." }, 503, headers);
  }

  return json({ deleted: true }, 200, headers);
});

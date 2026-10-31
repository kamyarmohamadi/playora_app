import { createClient } from "@supabase/supabase-js";

type AdminRole = "owner" | "finance_admin" | "support_admin";
type JsonObject = Record<string, unknown>;

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Vary": "Origin",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,23}$/;
const ASSET_RE = /^[A-Z0-9]{2,10}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
export function isAdminRole(value: unknown): value is AdminRole {
  return value === "owner" || value === "finance_admin" || value === "support_admin";
}
export function canReviewFinance(role: AdminRole): boolean {
  return role === "owner" || role === "finance_admin";
}
export function validateDepositNetwork(input: JsonObject) {
  const asset = typeof input.asset_code === "string" ? input.asset_code.trim().toUpperCase() : "";
  const network = typeof input.network_code === "string" ? input.network_code.trim().toUpperCase() : "";
  const address = typeof input.deposit_address === "string" ? input.deposit_address.trim() : "";
  const usd = Number(input.usd_per_asset);
  const min = Number(input.min_amount ?? 0.00000001);
  if (!ASSET_RE.test(asset) || !CODE_RE.test(network)) return { ok: false as const, error: "Invalid asset or network code." };
  if (address.length < 10 || address.length > 256) return { ok: false as const, error: "Invalid deposit address." };
  if (!Number.isFinite(usd) || usd <= 0 || usd > 1_000_000_000) return { ok: false as const, error: "Invalid USD asset price." };
  if (!Number.isFinite(min) || min <= 0 || min > 1_000_000_000) return { ok: false as const, error: "Invalid deposit minimum." };
  return { ok: true as const, value: {
    asset_code: asset, network_code: network, deposit_address: address,
    usd_per_asset: usd, coins_per_usd: 100 as const, min_amount: min,
    hash_case_insensitive: input.hash_case_insensitive !== false,
    is_enabled: input.is_enabled === true,
  }};
}
export function validateWithdrawalNetwork(input: JsonObject) {
  const asset = typeof input.asset_code === "string" ? input.asset_code.trim().toUpperCase() : "";
  const network = typeof input.network_code === "string" ? input.network_code.trim().toUpperCase() : "";
  const usd = Number(input.usd_per_asset);
  const fee = Number(input.network_fee_asset ?? 0);
  if (!ASSET_RE.test(asset) || !CODE_RE.test(network)) return { ok: false as const, error: "Invalid asset or network code." };
  if (!Number.isFinite(usd) || usd <= 0 || usd > 1_000_000_000) return { ok: false as const, error: "Invalid USD asset price." };
  if (!Number.isFinite(fee) || fee < 0 || fee > 1_000_000) return { ok: false as const, error: "Invalid network fee." };
  return { ok: true as const, value: {
    asset_code: asset, network_code: network, usd_per_asset: usd,
    network_fee_asset: fee, is_enabled: input.is_enabled === true,
  }};
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers });

async function readJson(request: Request, maxBytes = 8_192): Promise<JsonObject | null> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > maxBytes) return null;
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as JsonObject : null;
  } catch {
    return null;
  }
}

async function recordAudit(
  service: ReturnType<typeof createClient>,
  actorId: string,
  role: AdminRole,
  action: string,
  targetType: string,
  targetId: string | null,
  details: JsonObject,
) {
  const { error } = await service.from("platform_admin_audit_events").insert({
    actor_user_id: actorId,
    actor_role: role,
    action,
    target_type: targetType,
    target_id: targetId,
    outcome: "success",
    details,
  });
  return !error;
}

export async function handleFinanceAdmin(request: Request): Promise<Response> {
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const allowedOrigins = new Set((Deno.env.get("PLAYORA_ALLOWED_ORIGINS") ?? "")
    .split(",").map(value => value.trim()).filter(Boolean));
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    ...JSON_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "600",
  };
  if (origin) {
    if (!allowedOrigins.has(origin)) return json({ error: "Origin is not allowed." }, 403, headers);
    headers["Access-Control-Allow-Origin"] = origin;
  }
  if (request.method === "OPTIONS") {
    if (!origin || !allowedOrigins.has(origin)) return json({ error: "Origin is not allowed." }, 403, headers);
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { ...headers, Allow: "POST, OPTIONS" });
  if (!projectUrl || !publishableKey || !serviceRoleKey) return json({ error: "Finance admin service is not configured." }, 503, headers);

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ") || authorization.length > 8_200) {
    return json({ error: "Authentication is required." }, 401, headers);
  }
  const token = authorization.slice(7).trim();
  if (!token || token.length > 8_100) return json({ error: "Authentication is required." }, 401, headers);
  const input = await readJson(request);
  if (!input || typeof input.action !== "string") return json({ error: "Invalid request body." }, 400, headers);

  const caller = createClient(projectUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: "Bearer " + token } },
  });
  const { data: authData, error: authError } = await caller.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Session is invalid or expired." }, 401, headers);

  const service = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const actorId = authData.user.id;

  // Role is read from a private table. User metadata and client-provided roles are ignored.
  const { data: membership, error: membershipError } = await service
    .from("platform_admin_members").select("role,is_active")
    .eq("user_id", actorId).maybeSingle();
  if (membershipError || !membership || membership.is_active !== true || !isAdminRole(membership.role)) {
    return json({ error: "Administrator access is required." }, 403, headers);
  }
  const role = membership.role as AdminRole;
  const financeAllowed = canReviewFinance(role);

  const { count: recentActions, error: rateError } = await service
    .from("platform_admin_audit_events").select("id", { count: "exact", head: true })
    .eq("actor_user_id", actorId)
    .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString());
  if (rateError) return json({ error: "Unable to verify administrator rate limit." }, 503, headers);
  if ((recentActions ?? 0) >= 120) return json({ error: "Administrator rate limit exceeded." }, 429, headers);

  const action = input.action;
  const note = typeof input.review_note === "string" ? input.review_note.trim().slice(0, 1000) : null;
  let result: unknown;
  let targetType = "finance";
  let targetId: string | null = null;
  let auditDetails: JsonObject = {};

  if (action === "dashboard") {
    if (!financeAllowed) return json({ error: "Finance administrator access is required." }, 403, headers);
    const [deposits,duplicates,withdrawals,addresses,depositNetworks,withdrawalNetworks,gates] = await Promise.all([
      service.from("deposit_requests").select("id,user_id,asset_code,network_code,expected_amount,coin_amount,usd_value,tx_hash,status,transaction_at,created_at,duplicate_of_request_id,destination_address_snapshot,review_note,credited_at").order("created_at",{ascending:false}).limit(100),
      service.from("deposit_tx_duplicate_attempts").select("id,duplicate_request_id,first_request_id,attempted_by,attempted_at").order("attempted_at",{ascending:false}).limit(100),
      service.from("withdrawal_requests").select("id,user_id,requested_coins,asset_code,network_code,destination_address,usd_per_asset_snapshot,gross_asset_amount,network_fee_asset_amount,net_asset_amount,status,payout_tx_hash,actual_asset_amount,created_at,reviewed_at,paid_at,review_note").order("created_at",{ascending:false}).limit(100),
      service.from("member_payout_addresses").select("id,user_id,asset_code,network_code,wallet_address,verification_status,submitted_at,reviewed_at,review_note").order("submitted_at",{ascending:false}).limit(100),
      service.from("deposit_network_configs").select("asset_code,network_code,deposit_address,usd_per_asset,coins_per_usd,min_amount,hash_case_insensitive,is_enabled,updated_at").order("asset_code"),
      service.from("withdrawal_network_configs").select("asset_code,network_code,usd_per_asset,network_fee_asset,is_enabled,updated_at").order("asset_code"),
      service.from("member_gate_verifications").select("user_id,telegram_verified,phone_verified,wallet_verified,updated_at").order("updated_at",{ascending:false}).limit(100),
    ]);
    const errors = [deposits,duplicates,withdrawals,addresses,depositNetworks,withdrawalNetworks,gates].filter(x => x.error);
    if (errors.length) return json({ error: "Finance dashboard data could not be loaded." }, 503, headers);
    result = {
      deposits: deposits.data ?? [], duplicateAttempts: duplicates.data ?? [],
      withdrawals: withdrawals.data ?? [], payoutAddresses: addresses.data ?? [],
      depositNetworks: depositNetworks.data ?? [], withdrawalNetworks: withdrawalNetworks.data ?? [],
      memberVerifications: gates.data ?? [],
    };
    targetType = "finance_dashboard";
  } else if (action === "upsert_deposit_network") {
    if (role !== "owner") return json({ error: "Owner access is required to configure deposit networks." }, 403, headers);
    const config = validateDepositNetwork(input);
    if (!config.ok) return json({ error: config.error }, 400, headers);
    const { data, error } = await service.from("deposit_network_configs").upsert({
      ...config.value, updated_at: new Date().toISOString(), updated_by: actorId,
    }, { onConflict: "asset_code,network_code" }).select("asset_code,network_code,is_enabled").single();
    if (error) return json({ error: "Deposit network configuration could not be saved." }, 503, headers);
    result = data; targetType = "deposit_network";
    targetId = [data.asset_code,data.network_code].join(":");
    auditDetails = { asset_code: data.asset_code, network_code: data.network_code, is_enabled: data.is_enabled };
  } else if (action === "upsert_withdrawal_network") {
    if (role !== "owner") return json({ error: "Owner access is required to configure withdrawal networks." }, 403, headers);
    const config = validateWithdrawalNetwork(input);
    if (!config.ok) return json({ error: config.error }, 400, headers);
    const { data, error } = await service.from("withdrawal_network_configs").upsert({
      ...config.value, updated_at: new Date().toISOString(), updated_by: actorId,
    }, { onConflict: "asset_code,network_code" }).select("asset_code,network_code,is_enabled").single();
    if (error) return json({ error: "Withdrawal network configuration could not be saved." }, 503, headers);
    result = data; targetType = "withdrawal_network";
    targetId = [data.asset_code,data.network_code].join(":");
    auditDetails = { asset_code: data.asset_code, network_code: data.network_code, is_enabled: data.is_enabled };
  } else if (action === "review_deposit") {
    if (!financeAllowed || !isUuid(input.request_id) || typeof input.approve !== "boolean") return json({ error: "Invalid or unauthorized deposit review." }, 400, headers);
    const { data, error } = await service.rpc("review_deposit_request", {
      p_request_id: input.request_id, p_approve: input.approve, p_review_note: note,
    });
    if (error) return json({ error: "Deposit review was not completed." }, 409, headers);
    result = data; targetType = "deposit_request"; targetId = input.request_id;
    auditDetails = { approve: input.approve };
  } else if (action === "review_payout_address") {
    if (!financeAllowed || !isUuid(input.address_id) || typeof input.approve !== "boolean") return json({ error: "Invalid or unauthorized payout address review." }, 400, headers);
    const { data, error } = await service.rpc("review_member_payout_address", {
      p_address_id: input.address_id, p_approved: input.approve, p_review_note: note,
    });
    if (error) return json({ error: "Payout address review was not completed." }, 409, headers);
    result = data; targetType = "payout_address"; targetId = input.address_id;
    auditDetails = { approve: input.approve };
  } else if (action === "review_withdrawal") {
    if (!financeAllowed || !isUuid(input.request_id) || !["approve","reject","paid"].includes(String(input.payout_action))) return json({ error: "Invalid or unauthorized withdrawal review." }, 400, headers);
    const hash = typeof input.payout_tx_hash === "string" ? input.payout_tx_hash.trim() : null;
    const amount = input.actual_asset_amount === undefined || input.actual_asset_amount === null ? null : Number(input.actual_asset_amount);
    if (input.payout_action === "paid" && (!hash || hash.length < 16 || hash.length > 256 || /\s/.test(hash) || amount === null || !Number.isFinite(amount) || amount <= 0)) {
      return json({ error: "Valid payout transaction hash and actual amount are required." }, 400, headers);
    }
    const { data, error } = await service.rpc("review_withdrawal_request", {
      p_request_id: input.request_id, p_action: input.payout_action,
      p_payout_tx_hash: hash, p_actual_asset_amount: amount, p_review_note: note,
    });
    if (error) return json({ error: "Withdrawal review was not completed." }, 409, headers);
    result = data; targetType = "withdrawal_request"; targetId = input.request_id;
    auditDetails = { payout_action: input.payout_action };
  } else if (action === "set_member_verification") {
    if (!financeAllowed || !isUuid(input.user_id) || typeof input.telegram_verified !== "boolean" || typeof input.phone_verified !== "boolean") {
      return json({ error: "Invalid or unauthorized member verification update." }, 400, headers);
    }
    const { data: verifiedAddress, error: addressError } = await service.from("member_payout_addresses")
      .select("id").eq("user_id",input.user_id).eq("verification_status","verified").limit(1).maybeSingle();
    if (addressError) return json({ error: "Member verification could not be checked." }, 503, headers);
    const { error } = await service.rpc("set_member_gate_verification", {
      p_user_id: input.user_id, p_telegram_verified: input.telegram_verified,
      p_phone_verified: input.phone_verified, p_wallet_verified: !!verifiedAddress,
    });
    if (error) return json({ error: "Member verification flags could not be saved." }, 409, headers);
    result = { updated: true, wallet_verified: !!verifiedAddress };
    targetType = "member_verification"; targetId = input.user_id;
    auditDetails = { telegram_verified: input.telegram_verified, phone_verified: input.phone_verified, wallet_verified: !!verifiedAddress };
  } else if (action === "upsert_admin_member") {
    if (role !== "owner" || !isUuid(input.user_id) || !["owner","finance_admin","support_admin"].includes(String(input.role)) || typeof input.is_active !== "boolean") {
      return json({ error: "Only the owner can manage administrator membership." }, 403, headers);
    }
    const nextRole = input.role as AdminRole;
    if (input.user_id === actorId && (input.is_active === false || nextRole !== "owner")) {
      return json({ error: "The active owner cannot disable or demote their own membership." }, 409, headers);
    }
    if (input.is_active === false || nextRole !== "owner") {
      const { count, error: countError } = await service.from("platform_admin_members")
        .select("user_id",{count:"exact",head:true}).eq("role","owner").eq("is_active",true);
      if (countError) return json({ error: "Owner membership could not be checked." }, 503, headers);
      const { data: target } = await service.from("platform_admin_members")
        .select("role,is_active").eq("user_id",input.user_id).maybeSingle();
      if (target?.role === "owner" && target.is_active === true && (count ?? 0) <= 1 && nextRole !== "owner") {
        return json({ error: "At least one active owner must remain." }, 409, headers);
      }
    }
    const { error } = await service.from("platform_admin_members").upsert({
      user_id: input.user_id, role: nextRole, is_active: input.is_active,
      created_by: actorId, updated_at: new Date().toISOString(), updated_by: actorId,
    }, { onConflict: "user_id" });
    if (error) return json({ error: "Administrator membership could not be saved." }, 409, headers);
    result = { user_id: input.user_id, role: nextRole, is_active: input.is_active };
    targetType = "admin_member"; targetId = input.user_id;
    auditDetails = { role: nextRole, is_active: input.is_active };
  } else {
    return json({ error: "Unsupported finance admin action." }, 400, headers);
  }

  const auditSaved = await recordAudit(service,actorId,role,String(action).replaceAll("_","-"),targetType,targetId,auditDetails);
  return json({ ok: true, result, auditSaved },200,headers);
}

if (import.meta.main) Deno.serve(handleFinanceAdmin);

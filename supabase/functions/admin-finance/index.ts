import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  canPerformAdminAction,
  validateAdminActionPayload,
  type AdminAction,
  type AdminRole,
} from "./authorization.ts";

type JsonRecord = Record<string, unknown>;

const headersFor = (origin: string | null, allowed: Set<string>) => {
  const headers: Record<string,string> = {
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"private, no-store, max-age=0",
    "X-Content-Type-Options":"nosniff",
    "Referrer-Policy":"no-referrer",
    "Vary":"Origin",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age":"600",
  };
  if (origin && allowed.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
};

const respond = (body: unknown, status: number, headers: Record<string,string>) =>
  new Response(JSON.stringify(body), { status, headers });

const isObject = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function permissionFor(action: string): AdminAction | null {
  if (action === "configure_deposit_network" || action === "configure_withdrawal_network") return "configure_network";
  if (action === "manage_admin") return "manage_admin";
  if (action === "list_admins") return "list_admins";
  if (action === "dashboard") return "dashboard";
  if (action === "review_deposit") return "review_deposit";
  if (action === "review_payout_address") return "review_payout_address";
  if (action === "review_withdrawal") return "review_withdrawal";
  if (action === "set_member_verification") return "set_member_verification";
  return null;
}

Deno.serve(async (request: Request) => {
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const allowedOrigins = new Set((Deno.env.get("PLAYORA_ALLOWED_ORIGINS") ?? "")
    .split(",").map(value => value.trim()).filter(Boolean));
  const origin = request.headers.get("origin");
  const headers = headersFor(origin, allowedOrigins);

  if (!projectUrl || !publishableKey || !serviceRoleKey) {
    return respond({ error: "Finance administration is not configured." }, 503, headers);
  }
  if (origin && !allowedOrigins.has(origin)) {
    return respond({ error: "Origin is not allowed." }, 403, headers);
  }
  if (request.method === "OPTIONS") {
    if (!origin || !allowedOrigins.has(origin)) return respond({ error: "Origin is not allowed." }, 403, headers);
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405, { ...headers, Allow: "POST, OPTIONS" });

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ") || authorization.length > 8200) {
    return respond({ error: "Authentication is required." }, 401, headers);
  }
  const token = authorization.slice(7).trim();
  if (!token || token.length > 8100) return respond({ error: "Authentication is required." }, 401, headers);

  let payload: unknown;
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 32_000) return respond({ error: "Request is too large." }, 413, headers);
    const raw = await request.text();
    if (raw.length > 32_000) return respond({ error: "Request is too large." }, 413, headers);
    payload = JSON.parse(raw);
  } catch {
    return respond({ error: "Invalid JSON request." }, 400, headers);
  }
  if (!isObject(payload) || !validateAdminActionPayload(payload)) {
    return respond({ error: "Invalid finance operation." }, 400, headers);
  }

  const action = String(payload.action);
  const requiredPermission = permissionFor(action);
  if (!requiredPermission) return respond({ error: "Unknown finance operation." }, 400, headers);

  const caller = createClient(projectUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: "Bearer " + token } },
  });
  const { data: authData, error: authError } = await caller.auth.getUser(token);
  if (authError || !authData.user || authData.user.is_anonymous) {
    return respond({ error: "Session is invalid or expired." }, 401, headers);
  }

  const service = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: admin, error: adminError } = await service
    .from("platform_admin_members")
    .select("role,is_active")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (adminError) return respond({ error: "Admin access could not be verified." }, 503, headers);
  if (!admin || !admin.is_active || !canPerformAdminAction(admin.role, requiredPermission)) {
    return respond({ error: "You are not authorized to perform this operation." }, 403, headers);
  }

  const actorId = authData.user.id;
  const role = admin.role as AdminRole;
  let result: unknown = null;
  let targetType = action;
  let targetId: string | null = null;

  try {
    switch (action) {
      case "dashboard": {
        if (role === "support_admin") {
          const { data, error } = await service.from("member_gate_verifications")
            .select("user_id,telegram_verified,phone_verified,wallet_verified,updated_at")
            .order("updated_at", { ascending: false }).limit(100);
          if (error) throw new Error("verification_dashboard_failed");
          const ids = (data ?? []).map(row => row.user_id);
          const profiles = ids.length
            ? await service.from("member_profiles").select("user_id,username,display_name").in("user_id", ids)
            : { data: [], error: null };
          if (profiles.error) throw new Error("member_profile_query_failed");
          const profileMap = new Map((profiles.data ?? []).map(profile => [profile.user_id, profile]));
          result = { memberVerifications: (data ?? []).map(row => ({ ...row, member: profileMap.get(row.user_id) ?? null })) };
          break;
        }
        const [deposits, duplicates, payoutAddresses, withdrawals, admins] = await Promise.all([
          service.from("deposit_requests")
            .select("id,user_id,asset_code,network_code,expected_amount,tx_hash,status,usd_value,coin_amount,transaction_at,created_at,duplicate_of_request_id,review_note")
            .order("created_at", { ascending: false }).limit(100),
          service.from("deposit_tx_duplicate_attempts")
            .select("id,duplicate_request_id,first_request_id,attempted_by,attempted_at")
            .order("attempted_at", { ascending: false }).limit(100),
          service.from("member_payout_addresses")
            .select("id,user_id,asset_code,network_code,wallet_address,verification_status,submitted_at,reviewed_at,review_note")
            .order("submitted_at", { ascending: false }).limit(100),
          service.from("withdrawal_requests")
            .select("id,user_id,requested_coins,asset_code,network_code,destination_address,usd_per_asset_snapshot,gross_asset_amount,network_fee_asset_amount,net_asset_amount,status,payout_tx_hash,actual_asset_amount,created_at,reviewed_at,paid_at,review_note")
            .order("created_at", { ascending: false }).limit(100),
          role === "owner"
            ? service.from("platform_admin_members").select("user_id,role,is_active,created_at,updated_at").order("created_at", { ascending: true })
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (deposits.error || duplicates.error || payoutAddresses.error || withdrawals.error || admins.error) throw new Error("dashboard_query_failed");
        const ids = new Set<string>();
        for (const row of [...(deposits.data ?? []), ...(payoutAddresses.data ?? []), ...(withdrawals.data ?? [])]) ids.add(row.user_id);
        const profiles = ids.size
          ? await service.from("member_profiles").select("user_id,username,display_name").in("user_id", [...ids])
          : { data: [], error: null };
        if (profiles.error) throw new Error("member_profile_query_failed");
        const profileMap = new Map((profiles.data ?? []).map(profile => [profile.user_id, profile]));
        const attachMember = (rows: any[]) => rows.map(row => ({ ...row, member: profileMap.get(row.user_id) ?? null }));
        result = {
          depositRequests: attachMember(deposits.data ?? []),
          duplicateTransactionAttempts: duplicates.data ?? [],
          payoutAddresses: attachMember(payoutAddresses.data ?? []),
          withdrawalRequests: attachMember(withdrawals.data ?? []),
          admins: admins.data ?? [],
        };
        break;
      }
      case "configure_deposit_network": {
        const row = {
          asset_code: payload.asset_code,
          network_code: payload.network_code,
          deposit_address: (payload.deposit_address as string).trim(),
          usd_per_asset: payload.usd_per_asset,
          coins_per_usd: 100,
          min_amount: payload.min_amount,
          is_enabled: payload.is_enabled,
          updated_at: new Date().toISOString(),
          updated_by: actorId,
        };
        const { data, error } = await service.from("deposit_network_configs")
          .upsert(row, { onConflict: "asset_code,network_code" })
          .select("asset_code,network_code,is_enabled").single();
        if (error) throw new Error("deposit_network_update_failed");
        result = data;
        targetId = String(payload.asset_code) + ":" + String(payload.network_code);
        break;
      }
      case "configure_withdrawal_network": {
        const row = {
          asset_code: payload.asset_code,
          network_code: payload.network_code,
          usd_per_asset: payload.usd_per_asset,
          network_fee_asset: payload.network_fee_asset,
          is_enabled: payload.is_enabled,
          updated_at: new Date().toISOString(),
          updated_by: actorId,
        };
        const { data, error } = await service.from("withdrawal_network_configs")
          .upsert(row, { onConflict: "asset_code,network_code" })
          .select("asset_code,network_code,is_enabled").single();
        if (error) throw new Error("withdrawal_network_update_failed");
        result = data;
        targetId = String(payload.asset_code) + ":" + String(payload.network_code);
        break;
      }
      case "review_deposit": {
        const { data, error } = await service.rpc("review_deposit_request", {
          p_request_id: payload.request_id,
          p_approve: payload.approve,
          p_review_note: payload.note ?? null,
        });
        if (error) throw new Error("deposit_review_failed");
        result = data;
        targetId = String(payload.request_id);
        break;
      }
      case "review_payout_address": {
        const { data, error } = await service.rpc("review_member_payout_address", {
          p_address_id: payload.address_id,
          p_approved: payload.approve,
          p_review_note: payload.note ?? null,
        });
        if (error) throw new Error("payout_address_review_failed");
        result = { reviewed: Boolean(data) };
        targetId = String(payload.address_id);
        break;
      }
      case "review_withdrawal": {
        const { data, error } = await service.rpc("review_withdrawal_request", {
          p_request_id: payload.request_id,
          p_action: payload.decision,
          p_payout_tx_hash: payload.tx_hash ?? null,
          p_actual_asset_amount: payload.actual_asset_amount ?? null,
          p_review_note: payload.note ?? null,
        });
        if (error) throw new Error("withdrawal_review_failed");
        result = data;
        targetId = String(payload.request_id);
        break;
      }
      case "set_member_verification": {
        if (payload.wallet_verified === true) {
          const { data: verifiedAddress, error: addressError } = await service.from("member_payout_addresses")
            .select("id").eq("user_id", payload.user_id).eq("verification_status", "verified").limit(1).maybeSingle();
          if (addressError) throw new Error("wallet_verification_lookup_failed");
          if (!verifiedAddress) return respond({ error: "A verified payout address is required before wallet verification." }, 409, headers);
        }
        const { error } = await service.rpc("set_member_gate_verification", {
          p_user_id: payload.user_id,
          p_telegram_verified: payload.telegram_verified,
          p_phone_verified: payload.phone_verified,
          p_wallet_verified: payload.wallet_verified,
        });
        if (error) throw new Error("member_verification_update_failed");
        result = { updated: true };
        targetType = "member_verification";
        targetId = String(payload.user_id);
        break;
      }
      case "list_admins": {
        const { data, error } = await service.from("platform_admin_members")
          .select("user_id,role,is_active,created_at,updated_at")
          .order("created_at", { ascending: true });
        if (error) throw new Error("admin_list_failed");
        result = data ?? [];
        break;
      }
      case "manage_admin": {
        if (payload.user_id === actorId && payload.is_active === false) {
          return respond({ error: "An owner cannot deactivate their own account." }, 400, headers);
        }
        const row = {
          user_id: payload.user_id,
          role: payload.role,
          is_active: payload.is_active,
          updated_at: new Date().toISOString(),
          updated_by: actorId,
          created_by: actorId,
        };
        const { data, error } = await service.from("platform_admin_members")
          .upsert(row, { onConflict: "user_id" })
          .select("user_id,role,is_active").single();
        if (error) throw new Error("admin_membership_update_failed");
        result = data;
        targetType = "admin_membership";
        targetId = String(payload.user_id);
        break;
      }
      default:
        return respond({ error: "Unknown finance operation." }, 400, headers);
    }

    if (action !== "dashboard" && action !== "list_admins") {
      const { error: auditError } = await service.from("platform_admin_audit_events").insert({
        actor_user_id: actorId,
        actor_role: role,
        action,
        target_type: targetType,
        target_id: targetId,
        outcome: "success",
        details: {
          request_id: payload.request_id ?? null,
          address_id: payload.address_id ?? null,
        },
      });
      if (auditError) throw new Error("audit_write_failed");
    }
    return respond({ ok: true, result }, 200, headers);
  } catch {
    return respond({ error: "Finance administration operation failed. Refresh and retry or inspect the request audit." }, 409, headers);
  }
});

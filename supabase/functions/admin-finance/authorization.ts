export type AdminRole = "owner" | "finance_admin" | "support_admin";
export type AdminAction =
  | "dashboard" | "configure_network" | "review_deposit" | "review_payout_address"
  | "review_withdrawal" | "set_member_verification" | "list_admins" | "manage_admin";

const permissions: Record<AdminRole, ReadonlySet<AdminAction>> = {
  owner: new Set(["dashboard","configure_network","review_deposit","review_payout_address","review_withdrawal","set_member_verification","list_admins","manage_admin"]),
  finance_admin: new Set(["dashboard","configure_network","review_deposit","review_payout_address","review_withdrawal"]),
  support_admin: new Set(["dashboard","set_member_verification"]),
};

export function canPerformAdminAction(role: string, action: string): boolean {
  if (!(role in permissions)) return false;
  return permissions[role as AdminRole].has(action as AdminAction);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function isAssetCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z0-9]{2,10}$/.test(value);
}
export function isNetworkCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z0-9_-]{2,24}$/.test(value);
}
export function isSafeText(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.trim().length >= min && value.length <= max;
}
export function isPositiveFinite(value: unknown, maximum = 1_000_000_000): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= maximum;
}

export function validateAdminActionPayload(payload: unknown): payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const value = payload as Record<string, unknown>;
  if (!isSafeText(value.action, 3, 64)) return false;
  switch (value.action) {
    case "dashboard":
    case "check_access":
    case "list_admins":
      return true;
    case "configure_deposit_network":
      return isAssetCode(value.asset_code) && isNetworkCode(value.network_code)
        && isSafeText(value.deposit_address, 10, 256) && isPositiveFinite(value.usd_per_asset)
        && typeof value.min_amount === "number" && Number.isFinite(value.min_amount) && value.min_amount > 0
        && typeof value.is_enabled === "boolean";
    case "configure_withdrawal_network":
      return isAssetCode(value.asset_code) && isNetworkCode(value.network_code)
        && isPositiveFinite(value.usd_per_asset)
        && typeof value.network_fee_asset === "number" && Number.isFinite(value.network_fee_asset) && value.network_fee_asset >= 0
        && typeof value.is_enabled === "boolean";
    case "review_deposit":
      return isUuid(value.request_id) && typeof value.approve === "boolean"
        && (value.note === undefined || (typeof value.note === "string" && value.note.length <= 1000));
    case "review_payout_address":
      return isUuid(value.address_id) && typeof value.approve === "boolean"
        && (value.note === undefined || (typeof value.note === "string" && value.note.length <= 1000));
    case "review_withdrawal":
      return isUuid(value.request_id) && ["approve","reject","paid"].includes(String(value.decision))
        && (value.tx_hash === undefined || isSafeText(value.tx_hash, 16, 256))
        && (value.actual_asset_amount === undefined || isPositiveFinite(value.actual_asset_amount))
        && (value.note === undefined || (typeof value.note === "string" && value.note.length <= 1000));
    case "set_member_verification":
      return isUuid(value.user_id) && typeof value.telegram_verified === "boolean"
        && typeof value.phone_verified === "boolean" && typeof value.wallet_verified === "boolean";
    case "manage_admin":
      return isUuid(value.user_id) && ["owner","finance_admin","support_admin"].includes(String(value.role))
        && typeof value.is_active === "boolean";
    default:
      return false;
  }
}

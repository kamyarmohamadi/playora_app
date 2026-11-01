import { canReviewFinance, isAdminRole, isUuid, validateDepositNetwork, validateWithdrawalNetwork } from "./index.ts";

Deno.test("only owner and finance admin may review financial requests", () => {
  if (!canReviewFinance("owner") || !canReviewFinance("finance_admin") || canReviewFinance("support_admin")) {
    throw new Error("Finance role boundary is incorrect");
  }
});
Deno.test("admin roles are allow-listed", () => {
  for (const role of ["owner","finance_admin","support_admin"]) if (!isAdminRole(role)) throw new Error("Valid role rejected");
  for (const role of ["developer","member","OWNER",""]) if (isAdminRole(role)) throw new Error("Invalid role accepted");
});
Deno.test("UUID validator rejects malformed identifiers", () => {
  if (!isUuid("00000000-0000-4000-8000-000000000010")) throw new Error("Valid UUID rejected");
  if (isUuid("not-a-user-id") || isUuid("00000000-0000-4000-8000")) throw new Error("Malformed UUID accepted");
});
Deno.test("deposit config always uses one hundred coins per dollar", () => {
  const good = validateDepositNetwork({asset_code:"USDT",network_code:"TRC20",deposit_address:"T_TEST_ADDRESS_123456789",usd_per_asset:1,min_amount:0.1});
  if (!good.ok || good.value.coins_per_usd !== 100) throw new Error("Valid deposit config failed");
  const bad = validateDepositNetwork({asset_code:"USDT",network_code:"TRC20",deposit_address:"short",usd_per_asset:1});
  if (bad.ok) throw new Error("Invalid address accepted");
  const clientOverride = validateDepositNetwork({asset_code:"USDT",network_code:"TRC20",deposit_address:"T_TEST_ADDRESS_123456789",usd_per_asset:1,coins_per_usd:500});
  if (!clientOverride.ok || clientOverride.value.coins_per_usd !== 100) throw new Error("Client overrode fixed coin rate");
});
Deno.test("withdrawal config rejects non-positive price and negative fee", () => {
  const good = validateWithdrawalNetwork({asset_code:"USDT",network_code:"TRC20",usd_per_asset:1,network_fee_asset:0.1});
  if (!good.ok) throw new Error("Valid withdrawal config failed");
  const bad = validateWithdrawalNetwork({asset_code:"USDT",network_code:"TRC20",usd_per_asset:0,network_fee_asset:-1});
  if (bad.ok) throw new Error("Invalid withdrawal config accepted");
});

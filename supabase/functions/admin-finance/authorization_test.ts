import {
  canPerformAdminAction,
  isAssetCode,
  isNetworkCode,
  isPositiveFinite,
  isUuid,
  validateAdminActionPayload,
} from "./authorization.ts";

Deno.test("owner has all finance and operator permissions",()=>{
  for(const action of ["dashboard","configure_network","review_deposit","review_payout_address","review_withdrawal","set_member_verification","list_admins","manage_admin"]) {
    if(!canPerformAdminAction("owner",action)) throw new Error("owner denied "+action);
  }
});

Deno.test("finance admin cannot create or modify admin identities",()=>{
  if(!canPerformAdminAction("finance_admin","review_deposit")) throw new Error("finance admin cannot review deposits");
  if(canPerformAdminAction("finance_admin","manage_admin")) throw new Error("finance admin can manage admins");
  if(canPerformAdminAction("finance_admin","set_member_verification")) throw new Error("finance admin can set verification flags");
});

Deno.test("support admin cannot move funds or configure networks",()=>{
  if(!canPerformAdminAction("support_admin","set_member_verification")) throw new Error("support admin cannot review verification");
  for(const action of ["review_deposit","review_withdrawal","configure_network","manage_admin"]) {
    if(canPerformAdminAction("support_admin",action)) throw new Error("support admin improperly has "+action);
  }
});

Deno.test("unknown roles fail closed",()=>{
  for(const role of ["anon","authenticated","service_role","admin",""]) {
    if(canPerformAdminAction(role,"dashboard")) throw new Error("unexpected role privilege: "+role);
  }
});

Deno.test("format validators reject malformed values",()=>{
  if(!isAssetCode("USDT")||isAssetCode("usdt")||isAssetCode("USDT;DROP")) throw new Error("asset code validation");
  if(!isNetworkCode("TRC20")||isNetworkCode("TRC20/unsafe")) throw new Error("network code validation");
  if(!isUuid("00000000-0000-4000-8000-000000000001")||isUuid("not-a-uuid")) throw new Error("UUID validation");
  if(!isPositiveFinite(1)||isPositiveFinite(0)||isPositiveFinite(Infinity)||isPositiveFinite(1e20)) throw new Error("numeric validation");
});

Deno.test("request payload validation enforces complete fields",()=>{
  if(!validateAdminActionPayload({action:"review_deposit",request_id:"00000000-0000-4000-8000-000000000001",approve:true})) throw new Error("valid deposit review rejected");
  if(validateAdminActionPayload({action:"review_deposit",request_id:"bad",approve:true})) throw new Error("bad request UUID accepted");
  if(validateAdminActionPayload({action:"configure_deposit_network",asset_code:"USDT",network_code:"TRC20",deposit_address:"T_ADDRESS_123456789",usd_per_asset:1,min_amount:0,is_enabled:true})) throw new Error("zero min amount accepted");
  if(!validateAdminActionPayload({action:"manage_admin",user_id:"00000000-0000-4000-8000-000000000001",role:"owner",is_active:true})) throw new Error("valid admin management payload rejected");
});

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Check, LockKeyhole, RefreshCw, ShieldCheck, X } from "lucide-react";

type Locale = "en" | "fa";
type Props = { database: SupabaseClient<any>; locale: Locale };
type AdminRole = "owner" | "finance_admin" | "support_admin";
type AdminDashboard = {
  depositRequests?: any[];
  duplicateTransactionAttempts?: any[];
  payoutAddresses?: any[];
  withdrawalRequests?: any[];
  memberVerifications?: any[];
  admins?: any[];
};

const copy = {
  en: {
    title:"Finance & trust administration", subtitle:"Privileged actions are recorded in an immutable operator audit trail.",
    refresh:"Refresh", loading:"Loading admin workspace…", error:"The operation failed. Refresh and retry.",
    unauthorized:"This account does not have finance administration access.",
    role_owner:"Owner", role_finance_admin:"Finance administrator", role_support_admin:"Support administrator",
    deposits:"Deposit requests", noDeposits:"No deposit requests.", approve:"Approve and credit", reject:"Reject",
    txHash:"Transaction hash", amount:"Amount", coins:"Coins", network:"Network", member:"Member", status:"Status",
    duplicates:"Duplicate transaction claims", noDuplicates:"No duplicate claims recorded.",
    payoutAddresses:"Payout address verification", noPayoutAddresses:"No payout addresses registered.",
    verify:"Verify address", rejectAddress:"Reject address",
    withdrawals:"Withdrawal requests", noWithdrawals:"No withdrawal requests.",
    payoutHash:"Outgoing transaction hash", actualAmount:"Actual amount sent", approvePayout:"Approve request", markPaid:"Mark as paid", rejectWithdrawal:"Reject and refund",
    depositConfig:"Deposit network configuration", withdrawalConfig:"Withdrawal network configuration",
    asset:"Asset", address:"Receiving address", usdRate:"USD per asset", minAmount:"Minimum transfer", networkFee:"Network fee (asset units)", enabled:"Enable network", saveNetwork:"Save network",
    verification:"Member verification", userId:"Member user ID", telegram:"Telegram verified", phone:"Phone verified", wallet:"Wallet address verified", saveFlags:"Save verification flags",
    admins:"Admin accounts", noAdmins:"No admin identities seeded.", adminRole:"Role", active:"Active", addAdmin:"Add/update admin",
    note:"Review note", saved:"Saved", notConfigured:"No networks or actual payout addresses are configured. Do not process real transfers until verified values are added.",
    duplicateRef:"First request", firstClaimant:"Canonical claimant", auditNote:"All finance changes are logged with the acting operator and target record.",
    paidCoins:"Value coins", date:"Date", verified:"Verified", pending:"Pending", memberFlags:"Verification flags",
  },
  fa: {
    title:"مدیریت مالی و اعتماد", subtitle:"همهٔ عملیات مدیریتی در دفتر ثبت غیرقابل‌تغییر اپراتورها ثبت می‌شوند.",
    refresh:"به‌روزرسانی", loading:"در حال دریافت پنل مدیریت…", error:"عملیات انجام نشد. صفحه را به‌روزرسانی و دوباره تلاش کنید.",
    unauthorized:"این حساب دسترسی مدیریت مالی ندارد.",
    role_owner:"مالک", role_finance_admin:"مدیر مالی", role_support_admin:"مدیر پشتیبانی",
    deposits:"درخواست‌های واریز", noDeposits:"درخواستی برای واریز وجود ندارد.", approve:"تأیید و شارژ", reject:"رد درخواست",
    txHash:"هش تراکنش", amount:"مقدار", coins:"سکه", network:"شبکه", member:"عضو", status:"وضعیت",
    duplicates:"ادعاهای هش تکراری", noDuplicates:"ادعای تکراری ثبت نشده است.",
    payoutAddresses:"تأیید آدرس‌های برداشت", noPayoutAddresses:"آدرس برداشتی ثبت نشده است.",
    verify:"تأیید آدرس", rejectAddress:"رد آدرس",
    withdrawals:"درخواست‌های برداشت", noWithdrawals:"درخواست برداشتی وجود ندارد.",
    payoutHash:"هش تراکنش خروجی", actualAmount:"مقدار واقعی ارسال‌شده", approvePayout:"تأیید درخواست", markPaid:"ثبت پرداخت‌شده", rejectWithdrawal:"رد و بازگشت سکه",
    depositConfig:"تنظیم شبکهٔ واریز", withdrawalConfig:"تنظیم شبکهٔ برداشت",
    asset:"ارز", address:"آدرس دریافت", usdRate:"قیمت هر واحد به دلار", minAmount:"حداقل مقدار انتقال", networkFee:"کارمزد شبکه (واحد ارز)", enabled:"فعال‌سازی شبکه", saveNetwork:"ذخیره شبکه",
    verification:"تأیید اطلاعات عضو", userId:"شناسه کاربر", telegram:"تلگرام تأیید شده", phone:"شماره موبایل تأیید شده", wallet:"آدرس کیف پول تأیید شده", saveFlags:"ذخیره وضعیت تأییدها",
    admins:"حساب‌های مدیر", noAdmins:"هنوز مدیر اولیه‌ای ثبت نشده است.", adminRole:"نقش", active:"فعال", addAdmin:"ثبت/به‌روزرسانی مدیر",
    note:"یادداشت بررسی", saved:"ذخیره شد", notConfigured:"هنوز هیچ شبکه یا آدرس واقعی تنظیم نشده است. تا ثبت مقادیر معتبر، انتقال واقعی انجام ندهید.",
    duplicateRef:"درخواست اول", firstClaimant:"ثبت‌کننده مرجع", auditNote:"تمام تغییرات مالی همراه با اپراتور و رکورد هدف ثبت می‌شوند.",
    paidCoins:"سکه ارزشمند", date:"تاریخ", verified:"تأییدشده", pending:"در انتظار", memberFlags:"وضعیت تأیید عضو",
  },
} as const;

function fmtDate(value: string | undefined, locale: Locale) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale==="fa"?"fa-IR":"en-GB",{dateStyle:"medium",timeStyle:"short"}).format(date);
}
function formatState(value: string | undefined, t: (typeof copy)[Locale]) {
  if (!value) return "—";
  const map:Record<string,string>={credited:t.verified,under_review:t.pending,pending:t.pending,approved:t.verified,paid:t.verified,rejected:t.reject,duplicate:t.reject,verified:t.verified};
  return map[value]??value;
}

export function FinanceAdminPanel({database,locale}:Props) {
  const t=copy[locale];
  const [role,setRole]=useState<AdminRole|null>(null);
  const [dashboard,setDashboard]=useState<AdminDashboard|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [note,setNote]=useState("");
  const [payoutHash,setPayoutHash]=useState("");
  const [actualAmount,setActualAmount]=useState("");
  const [depositConfig,setDepositConfig]=useState({asset:"",network:"",address:"",rate:"",min:"0.00000001",enabled:false});
  const [withdrawConfig,setWithdrawConfig]=useState({asset:"",network:"",rate:"",fee:"0",enabled:false});
  const [memberId,setMemberId]=useState("");
  const [flags,setFlags]=useState({telegram:false,phone:false,wallet:false});
  const [adminUserId,setAdminUserId]=useState("");
  const [adminRole,setAdminRole]=useState<AdminRole>("finance_admin");

  const invoke=useCallback(async(payload:Record<string,unknown>)=>{
    const {data,error}=await database.functions.invoke("admin-finance",{body:payload});
    if(error) throw error;
    if(!data?.ok) throw new Error("admin_operation_failed");
    return data.result;
  },[database]);

  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const access=await invoke({action:"check_access"});
      const dashboardData=await invoke({action:"dashboard"});
      setRole(access.role as AdminRole);
      setDashboard(dashboardData as AdminDashboard);
    }catch{
      setRole(null);setDashboard(null);setError(t.unauthorized);
    }finally{setLoading(false);}
  },[invoke,t.unauthorized]);

  useEffect(()=>{void refresh();},[refresh]);

  const run=async(payload:Record<string,unknown>)=>{
    setBusy(true);setError("");
    try{await invoke(payload);setNote(t.saved);await refresh();}
    catch{setError(t.error);}
    finally{setBusy(false);}
  };

  if(loading)return <section className="finance-admin-panel"><p>{t.loading}</p></section>;
  if(!role||!dashboard)return <></>;

  return <section className="finance-admin-panel">
    <header className="finance-admin-heading">
      <div><span className="section-eyebrow">PLAYORA ADMIN</span><h2>{t.title}</h2><p>{t.subtitle}</p><span className="finance-admin-role"><ShieldCheck size={13}/>{t["role_"+role]}</span></div>
      <button className="financial-refresh-btn" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={14}/>{t.refresh}</button>
    </header>
    <p className="finance-admin-warning"><LockKeyhole size={14}/>{t.notConfigured}</p>
    <p className="finance-admin-audit"><ShieldCheck size={13}/>{t.auditNote}</p>
    {error&&<p className="financial-error" role="alert">{error}</p>}
    {note&&<p className="finance-admin-success" role="status">{note}</p>}

    {dashboard.memberVerifications&&<section className="finance-admin-card">
      <h3>{t.memberFlags}</h3>
      {dashboard.memberVerifications.map(row=><article className="finance-admin-row" key={row.user_id}>
        <div><b>{row.member?.display_name??row.user_id}</b><small>{row.member?.username??row.user_id} · {fmtDate(row.updated_at,locale)}</small>
          <small>{t.telegram}: {String(row.telegram_verified)} · {t.phone}: {String(row.phone_verified)} · {t.wallet}: {String(row.wallet_verified)}</small></div>
      </article>)}
    </section>}

    {role!=="support_admin"&&<>
      <section className="finance-admin-card">
        <h3>{t.deposits}</h3>
        {!dashboard.depositRequests?.length?<p>{t.noDeposits}</p>:dashboard.depositRequests.map(row=><article className="finance-admin-row" key={row.id}>
          <div className="finance-admin-row-main"><b>{row.member?.display_name??row.user_id}</b><small>{row.asset_code} · {row.network_code} · {row.expected_amount} · {fmtDate(row.created_at,locale)}</small>
            <code>{row.tx_hash??"—"}</code><small>{row.coin_amount} {t.coins} · {formatState(row.status,t)}</small></div>
          {row.status==="under_review"&&<div className="finance-admin-actions">
            <button disabled={busy} onClick={()=>void run({action:"review_deposit",request_id:row.id,approve:true,note})}><Check size={13}/>{t.approve}</button>
            <button className="danger" disabled={busy} onClick={()=>void run({action:"review_deposit",request_id:row.id,approve:false,note})}><X size={13}/>{t.reject}</button>
          </div>}
        </article>)}
        <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder={t.note}/>
      </section>

      <section className="finance-admin-card">
        <h3>{t.duplicates}</h3>
        {!dashboard.duplicateTransactionAttempts?.length?<p>{t.noDuplicates}</p>:dashboard.duplicateTransactionAttempts.map(row=><article className="finance-admin-row" key={row.id}>
          <div><b>{row.duplicate_request_id}</b><small>{t.duplicateRef}: {row.first_request_id}</small><small>{t.date}: {fmtDate(row.attempted_at,locale)}</small></div>
        </article>)}
      </section>

      <section className="finance-admin-card">
        <h3>{t.payoutAddresses}</h3>
        {!dashboard.payoutAddresses?.length?<p>{t.noPayoutAddresses}</p>:dashboard.payoutAddresses.map(row=><article className="finance-admin-row" key={row.id}>
          <div className="finance-admin-row-main"><b>{row.member?.display_name??row.user_id}</b><small>{row.asset_code} · {row.network_code} · {fmtDate(row.submitted_at,locale)}</small><code>{row.wallet_address}</code><small>{formatState(row.verification_status,t)}</small></div>
          {row.verification_status==="pending"&&<div className="finance-admin-actions">
            <button disabled={busy} onClick={()=>void run({action:"review_payout_address",address_id:row.id,approve:true,note})}><Check size={13}/>{t.verify}</button>
            <button className="danger" disabled={busy} onClick={()=>void run({action:"review_payout_address",address_id:row.id,approve:false,note})}><X size={13}/>{t.rejectAddress}</button>
          </div>}
        </article>)}
      </section>

      <section className="finance-admin-card">
        <h3>{t.withdrawals}</h3>
        {!dashboard.withdrawalRequests?.length?<p>{t.noWithdrawals}</p>:dashboard.withdrawalRequests.map(row=><article className="finance-admin-row" key={row.id}>
          <div className="finance-admin-row-main"><b>{row.member?.display_name??row.user_id}</b><small>{row.asset_code} · {row.network_code} · {row.requested_coins} {t.coins} · {fmtDate(row.created_at,locale)}</small>
            <code>{row.destination_address}</code><small>{formatState(row.status,t)} · {t.net}: {row.net_asset_amount} {row.asset_code}</small></div>
          {row.status==="pending"&&<div className="finance-admin-actions">
            <button disabled={busy} onClick={()=>void run({action:"review_withdrawal",request_id:row.id,decision:"approve",note})}><Check size={13}/>{t.approvePayout}</button>
            <button className="danger" disabled={busy} onClick={()=>void run({action:"review_withdrawal",request_id:row.id,decision:"reject",note})}><X size={13}/>{t.rejectWithdrawal}</button>
          </div>}
          {row.status==="approved"&&<form className="finance-admin-paid-form" onSubmit={e=>{e.preventDefault();void run({action:"review_withdrawal",request_id:row.id,decision:"paid",tx_hash:payoutHash,actual_asset_amount:Number(actualAmount),note});}}>
            <input value={payoutHash} onChange={e=>setPayoutHash(e.target.value)} placeholder={t.payoutHash} minLength={16} maxLength={256} required/>
            <input type="number" value={actualAmount} onChange={e=>setActualAmount(e.target.value)} placeholder={t.actualAmount} min="0.00000001" step="any" required/>
            <button type="submit" disabled={busy}>{t.markPaid}</button>
          </form>}
        </article>)}
      </section>

      <section className="finance-admin-grid">
        <form className="finance-admin-card" onSubmit={e=>{e.preventDefault();void run({action:"configure_deposit_network",asset_code:depositConfig.asset.toUpperCase(),network_code:depositConfig.network.toUpperCase(),deposit_address:depositConfig.address,usd_per_asset:Number(depositConfig.rate),min_amount:Number(depositConfig.min),is_enabled:depositConfig.enabled});}}>
          <h3>{t.depositConfig}</h3>
          <input value={depositConfig.asset} onChange={e=>setDepositConfig(v=>({...v,asset:e.target.value}))} placeholder={t.asset} required/>
          <input value={depositConfig.network} onChange={e=>setDepositConfig(v=>({...v,network:e.target.value}))} placeholder={t.network} required/>
          <input value={depositConfig.address} onChange={e=>setDepositConfig(v=>({...v,address:e.target.value}))} placeholder={t.address} required/>
          <input type="number" min="0.00000001" step="any" value={depositConfig.rate} onChange={e=>setDepositConfig(v=>({...v,rate:e.target.value}))} placeholder={t.usdRate} required/>
          <input type="number" min="0.00000001" step="any" value={depositConfig.min} onChange={e=>setDepositConfig(v=>({...v,min:e.target.value}))} placeholder={t.minAmount} required/>
          <label><input type="checkbox" checked={depositConfig.enabled} onChange={e=>setDepositConfig(v=>({...v,enabled:e.target.checked}))}/>{t.enabled}</label>
          <button type="submit" disabled={busy}>{t.saveNetwork}</button>
        </form>
        <form className="finance-admin-card" onSubmit={e=>{e.preventDefault();void run({action:"configure_withdrawal_network",asset_code:withdrawConfig.asset.toUpperCase(),network_code:withdrawConfig.network.toUpperCase(),usd_per_asset:Number(withdrawConfig.rate),network_fee_asset:Number(withdrawConfig.fee),is_enabled:withdrawConfig.enabled});}}>
          <h3>{t.withdrawalConfig}</h3>
          <input value={withdrawConfig.asset} onChange={e=>setWithdrawConfig(v=>({...v,asset:e.target.value}))} placeholder={t.asset} required/>
          <input value={withdrawConfig.network} onChange={e=>setWithdrawConfig(v=>({...v,network:e.target.value}))} placeholder={t.network} required/>
          <input type="number" min="0.00000001" step="any" value={withdrawConfig.rate} onChange={e=>setWithdrawConfig(v=>({...v,rate:e.target.value}))} placeholder={t.usdRate} required/>
          <input type="number" min="0" step="any" value={withdrawConfig.fee} onChange={e=>setWithdrawConfig(v=>({...v,fee:e.target.value}))} placeholder={t.networkFee} required/>
          <label><input type="checkbox" checked={withdrawConfig.enabled} onChange={e=>setWithdrawConfig(v=>({...v,enabled:e.target.checked}))}/>{t.enabled}</label>
          <button type="submit" disabled={busy}>{t.saveNetwork}</button>
        </form>
      </section>

      <section className="finance-admin-card">
        <h3>{t.verification}</h3>
        <form className="finance-admin-verification-form" onSubmit={e=>{e.preventDefault();void run({action:"set_member_verification",user_id:memberId,telegram_verified:flags.telegram,phone_verified:flags.phone,wallet_verified:flags.wallet});}}>
          <input value={memberId} onChange={e=>setMemberId(e.target.value)} placeholder={t.userId} required/>
          {(["telegram","phone","wallet"] as const).map(key=><label key={key}><input type="checkbox" checked={flags[key]} onChange={e=>setFlags(v=>({...v,[key]:e.target.checked}))}/>{t[key]}</label>)}
          <button type="submit" disabled={busy}>{t.saveFlags}</button>
        </form>
      </section>
    </>}

    {role==="owner"&&<section className="finance-admin-card">
      <h3>{t.admins}</h3>
      {!dashboard.admins?.length?<p>{t.noAdmins}</p>:dashboard.admins.map(admin=><article className="finance-admin-row" key={admin.user_id}><div><b>{admin.user_id}</b><small>{t["role_"+admin.role as keyof typeof t]??admin.role} · {admin.is_active?t.active:t.pending}</small></div></article>)}
      <form className="finance-admin-paid-form" onSubmit={e=>{e.preventDefault();void run({action:"manage_admin",user_id:adminUserId,role:adminRole,is_active:true});}}>
        <input value={adminUserId} onChange={e=>setAdminUserId(e.target.value)} placeholder={t.userId} required/>
        <select value={adminRole} onChange={e=>setAdminRole(e.target.value as AdminRole)}><option value="finance_admin">{t.role_finance_admin}</option><option value="support_admin">{t.role_support_admin}</option></select>
        <button type="submit" disabled={busy}>{t.addAdmin}</button>
      </form>
    </section>}
  </section>;
}

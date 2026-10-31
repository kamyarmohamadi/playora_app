import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Activity, ArrowDownToLine, ArrowUpFromLine, Copy, History, LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck, Wallet } from "lucide-react";

type Locale = "en" | "fa";
type WalletSnapshot = { free_coins: number | string; purchased_coins: number | string; reward_coins: number | string };
type DepositOption = { asset_code: string; network_code: string; deposit_address: string; usd_per_asset: number | string; coins_per_usd: number; min_amount: number | string };
type WithdrawalOption = { asset_code: string; network_code: string; usd_per_asset: number | string; network_fee_asset: number | string };
type Summary = { lifetime_deposit_coins: number | string; turnover_required: number | string; turnover_completed: number | string; turnover_remaining: number | string; value_wallet_coins: number | string; daily_withdrawal_remaining: number | string; weekly_withdrawal_remaining: number | string };
type DepositRow = { id: string; asset_code: string; network_code: string; status: string; coin_amount: number | string; created_at: string };
type WithdrawalRow = { id: string; requested_coins: number | string; asset_code: string; network_code: string; status: string; created_at: string };
type Props = { database: SupabaseClient<any>; userId: string; locale: Locale; wallet: WalletSnapshot | null; onNotify?: (message: string) => void };

const words = {
  en: {
    title:"Your wallets", sub:"Free coins and real-value coins are held separately.", total:"Combined balance",
    free:"Free Wallet", value:"Value Wallet", deposit:"Deposit", withdraw:"Withdraw",
    depositHelp:"Choose a configured asset and network. Send only to the exact address shown here.",
    withdrawHelp:"Requests are reviewed manually. The requested coins are reserved while pending.",
    noDeposit:"Deposit networks are not configured yet. Do not send crypto until a verified address appears here.",
    noWithdraw:"Withdrawal networks are not configured yet.",
    network:"Network", amount:"Amount", txHash:"Transaction hash", txTime:"Transaction time",
    destination:"Your receiving wallet address", sendDeposit:"Submit deposit details", sendWithdraw:"Request withdrawal",
    min:"Minimum withdrawal: 500 coins", estimate:"Estimated credit", usd:"USD value", coins:"coins",
    fee:"Network fee", net:"Estimated amount you receive", feeNote:"Network fees are deducted from the payout; the final received amount may differ.",
    lifetime:"Verified deposits", turnover:"Deposit turnover", done:"Completed", remaining:"Remaining",
    daily:"Daily limit remaining", weekly:"Weekly limit remaining", deposits:"Recent deposits", withdrawals:"Recent withdrawals",
    empty:"No transactions yet.", copyAddress:"Copy deposit address", copied:"Deposit address copied.", depositSent:"Deposit details submitted for manual review.",
    withdrawSent:"Withdrawal request submitted for manual review.", review:"Manual review may take up to 24 hours.",
    turnoverNote:"Only completed human-vs-human Paid matches funded by your own deposit coins count toward the 20% turnover. Signup gifts do not count.",
    refresh:"Refresh", loading:"Loading…", required:"Complete all required fields.", error:"Request failed. Check your details and try again.",
    created:"Created", under_review:"Under review", pending_confirmation:"Pending confirmation", credited:"Credited",
    rejected:"Rejected", duplicate:"Duplicate transaction", expired:"Expired", pending:"Pending review", approved:"Approved",
    paid:"Paid", currency:"", noNetworks:"No configured network",
  },
  fa: {
    title:"کیف پول‌های شما", sub:"سکه‌های رایگان و سکه‌های دارای ارزش واقعی جداگانه نگهداری می‌شوند.",
    total:"موجودی مجموع", free:"کیف پول رایگان", value:"کیف پول ارزشمند", deposit:"واریز", withdraw:"برداشت",
    depositHelp:"ارز و شبکهٔ تنظیم‌شده را انتخاب کنید. فقط به آدرسی که اینجا نمایش داده می‌شود ارسال کنید.",
    withdrawHelp:"درخواست‌ها دستی بررسی می‌شوند. سکه‌های درخواستی تا زمان بررسی رزرو خواهند شد.",
    noDeposit:"هنوز شبکه و آدرس واریزی تنظیم نشده است. تا نمایش آدرس معتبر، رمزارزی ارسال نکنید.",
    noWithdraw:"هنوز شبکه‌ای برای برداشت تنظیم نشده است.",
    network:"شبکه", amount:"مقدار", txHash:"هش تراکنش", txTime:"زمان تراکنش",
    destination:"آدرس کیف پول مقصد شما", sendDeposit:"ثبت اطلاعات واریز", sendWithdraw:"ثبت درخواست برداشت",
    min:"حداقل برداشت: ۵۰۰ سکه", estimate:"اعتبار تقریبی", usd:"ارزش دلاری", coins:"سکه",
    fee:"کارمزد شبکه", net:"مقدار تقریبی دریافتی", feeNote:"کارمزد شبکه از پرداخت کسر می‌شود؛ مبلغ نهایی ممکن است کمی متفاوت باشد.",
    lifetime:"واریزهای تأییدشده", turnover:"گردش واریز", done:"انجام‌شده", remaining:"باقی‌مانده",
    daily:"مانده سقف روزانه", weekly:"مانده سقف هفتگی", deposits:"واریزهای اخیر", withdrawals:"برداشت‌های اخیر",
    empty:"هنوز تراکنشی ثبت نشده است.", copyAddress:"کپی آدرس واریز", copied:"آدرس واریز کپی شد.", depositSent:"اطلاعات واریز برای بررسی دستی ثبت شد.",
    withdrawSent:"درخواست برداشت برای بررسی دستی ثبت شد.", review:"بررسی دستی ممکن است تا ۲۴ ساعت زمان ببرد.",
    turnoverNote:"فقط ورودیهٔ مسابقات کامل‌شدهٔ پولی با انسان واقعی که از سکه‌های واریزی خودتان تأمین شده باشد، در شرط گردش ۲۰٪ محاسبه می‌شود. هدیهٔ ثبت‌نام محاسبه نمی‌شود.",
    refresh:"به‌روزرسانی", loading:"در حال دریافت اطلاعات…", required:"همهٔ فیلدهای لازم را کامل کنید.",
    error:"درخواست ثبت نشد. اطلاعات را بررسی و دوباره تلاش کنید.",
    created:"ایجادشده", under_review:"در حال بررسی", pending_confirmation:"در انتظار تأیید شبکه", credited:"شارژشده",
    rejected:"ردشده", duplicate:"تراکنش تکراری", expired:"منقضی‌شده", pending:"در انتظار بررسی",
    approved:"تأیید برای پرداخت", paid:"پرداخت‌شده", currency:"", noNetworks:"شبکه‌ای تنظیم نشده است",
  },
} as const;

function fmt(v: number | string | null | undefined, locale: Locale, digits = 0) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", { maximumFractionDigits: digits }).format(n) : "—";
}
function dateFmt(v: string, locale: Locale) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(d);
}
const optionKey = (asset: string, network: string) => asset + ":" + network;

export function FinancialWalletPanel({ database, userId, locale, wallet, onNotify }: Props) {
  const t = words[locale];
  const [depOptions, setDepOptions] = useState<DepositOption[]>([]);
  const [wdOptions, setWdOptions] = useState<WithdrawalOption[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [depRows, setDepRows] = useState<DepositRow[]>([]);
  const [wdRows, setWdRows] = useState<WithdrawalRow[]>([]);
  const [depSelected, setDepSelected] = useState("");
  const [wdSelected, setWdSelected] = useState("");
  const [depAmount, setDepAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [txTime, setTxTime] = useState("");
  const [wdAmount, setWdAmount] = useState("500");
  const [wdAddress, setWdAddress] = useState("");
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const [dep, wd, sum, depHistory, wdHistory] = await Promise.all([
      database.rpc("get_deposit_options"),
      database.rpc("get_withdrawal_options"),
      database.rpc("get_my_financial_summary"),
      database.from("deposit_requests").select("id,asset_code,network_code,status,coin_amount,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(12),
      database.from("withdrawal_requests").select("id,requested_coins,asset_code,network_code,status,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(12),
    ]);
    if (dep.error || wd.error || sum.error || depHistory.error || wdHistory.error) setError(t.error);
    const d = !dep.error && Array.isArray(dep.data) ? dep.data as DepositOption[] : [];
    const w = !wd.error && Array.isArray(wd.data) ? wd.data as WithdrawalOption[] : [];
    setDepOptions(d);
    setWdOptions(w);
    setSummary(!sum.error && Array.isArray(sum.data) ? (sum.data[0] as Summary | undefined) ?? null : null);
    setDepRows(!depHistory.error && Array.isArray(depHistory.data) ? depHistory.data as DepositRow[] : []);
    setWdRows(!wdHistory.error && Array.isArray(wdHistory.data) ? wdHistory.data as WithdrawalRow[] : []);
    setDepSelected(x => x && d.some(o => optionKey(o.asset_code, o.network_code) === x) ? x : (d[0] ? optionKey(d[0].asset_code, d[0].network_code) : ""));
    setWdSelected(x => x && w.some(o => optionKey(o.asset_code, o.network_code) === x) ? x : (w[0] ? optionKey(w[0].asset_code, w[0].network_code) : ""));
    setLoading(false);
  }, [database, userId, t.error]);

  useEffect(() => { void refresh(); }, [refresh]);

  const depOption = useMemo(() => depOptions.find(o => optionKey(o.asset_code, o.network_code) === depSelected) ?? null, [depOptions, depSelected]);
  const wdOption = useMemo(() => wdOptions.find(o => optionKey(o.asset_code, o.network_code) === wdSelected) ?? null, [wdOptions, wdSelected]);
  const amount = Math.max(0, Number(depAmount) || 0);
  const usd = depOption ? amount * Number(depOption.usd_per_asset) : 0;
  const coins = depOption ? Math.round(usd * Number(depOption.coins_per_usd || 100)) : 0;
  const coinsToWithdraw = Math.floor(Number(wdAmount) || 0);
  const gross = wdOption ? (coinsToWithdraw / 100) / Number(wdOption.usd_per_asset) : 0;
  const fee = wdOption ? Number(wdOption.network_fee_asset) : 0;
  const net = Math.max(0, gross - fee);
  const freeBalance = wallet ? Number(wallet.free_coins) + Number(wallet.reward_coins) : null;
  const valueBalance = wallet ? Number(wallet.purchased_coins) : Number(summary?.value_wallet_coins ?? 0);

  const submitDeposit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!depOption || amount < Number(depOption.min_amount) || !txHash.trim() || !txTime) { setError(t.required); return; }
    setBusy(true); setError("");
    try {
      const { error: err } = await database.rpc("submit_deposit_claim", {
        p_asset_code: depOption.asset_code, p_network_code: depOption.network_code,
        p_amount: amount, p_tx_hash: txHash.trim(), p_transaction_at: new Date(txTime).toISOString(),
      });
      if (err) throw err;
      setDepAmount(""); setTxHash(""); setTxTime("");
      onNotify?.(t.depositSent);
      await refresh();
    } catch { setError(t.error); }
    finally { setBusy(false); }
  };

  const submitWithdrawal = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!wdOption || coinsToWithdraw < 500 || !wdAddress.trim()) { setError(t.required); return; }
    if (coinsToWithdraw > Number(summary?.value_wallet_coins ?? wallet?.purchased_coins ?? 0)) { setError(t.error); return; }
    setBusy(true); setError("");
    try {
      const { error: err } = await database.rpc("request_withdrawal", {
        p_requested_coins: coinsToWithdraw, p_asset_code: wdOption.asset_code,
        p_network_code: wdOption.network_code, p_destination_address: wdAddress.trim(),
      });
      if (err) throw err;
      setWdAddress("");
      onNotify?.(t.withdrawSent);
      await refresh();
    } catch { setError(t.error); }
    finally { setBusy(false); }
  };

  const copyAddress = async (address: string) => {
    try { await navigator.clipboard.writeText(address); onNotify?.(t.copied); }
    catch { setError(t.error); }
  };

  const statusText = (s: string) => (t as Record<string, string>)[s] ?? s;

  return (
    <section className="financial-wallet-page">
      <header className="financial-wallet-heading">
        <div><span className="section-eyebrow">PLAYORA FINANCE</span><h2>{t.title}</h2><p>{t.sub}</p></div>
        <button className="financial-refresh-btn" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14} />{t.refresh}</button>
      </header>
      <section className="financial-wallet-balances">
        <article className="financial-balance-card combined"><span>{t.total}</span><strong>{fmt((freeBalance ?? 0) + (valueBalance ?? 0), locale)}</strong></article>
        <article className="financial-balance-card free"><span><Wallet size={14} />{t.free}</span><strong>{freeBalance === null ? "—" : fmt(freeBalance, locale)}</strong></article>
        <article className="financial-balance-card value"><span><ShieldCheck size={14} />{t.value}</span><strong>{fmt(valueBalance, locale)}</strong></article>
      </section>
      <section className="financial-summary-grid">
        <article><span>{t.lifetime}</span><strong>{fmt(summary?.lifetime_deposit_coins, locale)} {t.coins}</strong></article>
        <article><span>{t.turnover}</span><strong>{fmt(summary?.turnover_completed, locale)} / {fmt(summary?.turnover_required, locale)}</strong><small>{t.remaining}: {fmt(summary?.turnover_remaining, locale)}</small></article>
        <article><span>{t.daily}</span><strong>{fmt(summary?.daily_withdrawal_remaining, locale)}</strong></article>
        <article><span>{t.weekly}</span><strong>{fmt(summary?.weekly_withdrawal_remaining, locale)}</strong></article>
      </section>
      <p className="financial-turnover-note"><LockKeyhole size={13} />{t.turnoverNote}</p>

      <section className="financial-flow-card">
        <div className="financial-flow-tabs">
          <button className={tab === "deposit" ? "active" : ""} onClick={() => { setTab("deposit"); setError(""); }}><ArrowDownToLine size={15} />{t.deposit}</button>
          <button className={tab === "withdraw" ? "active" : ""} onClick={() => { setTab("withdraw"); setError(""); }}><ArrowUpFromLine size={15} />{t.withdraw}</button>
        </div>
        {tab === "deposit" ? <div className="financial-flow-body">
          <p>{t.depositHelp}</p>
          {!depOptions.length ? <div className="financial-not-configured"><ShieldCheck size={23} /><b>{t.noDeposit}</b></div> : (
            <form className="financial-form" onSubmit={e => void submitDeposit(e)}>
              <label>{t.network}<select value={depSelected} onChange={e => setDepSelected(e.target.value)} required>{depOptions.map(o => <option key={optionKey(o.asset_code,o.network_code)} value={optionKey(o.asset_code,o.network_code)}>{o.asset_code} · {o.network_code}</option>)}</select></label>
              {depOption && <div className="financial-deposit-address"><span>{depOption.asset_code} · {depOption.network_code}</span><code>{depOption.deposit_address}</code><button type="button" onClick={() => void copyAddress(depOption.deposit_address)}><Copy size={13} />{t.copyAddress}</button></div>}
              <label>{t.amount} ({depOption?.asset_code ?? ""})<input type="number" inputMode="decimal" min={depOption ? String(depOption.min_amount) : "0.00000001"} step="any" value={depAmount} onChange={e => setDepAmount(e.target.value)} required /></label>
              <div className="financial-conversion"><span>{t.usd}</span><b>{"$"}{fmt(usd, locale, 4)}</b><span>{t.estimate}</span><b>{fmt(coins, locale)} {t.coins}</b></div>
              <label>{t.txHash}<input value={txHash} onChange={e => setTxHash(e.target.value)} minLength={16} maxLength={256} autoComplete="off" required /></label>
              <label>{t.txTime}<input type="datetime-local" value={txTime} onChange={e => setTxTime(e.target.value)} required /></label>
              <button className="financial-submit-btn" type="submit" disabled={busy || loading}>{busy ? <LoaderCircle className="spin" size={15} /> : <ArrowDownToLine size={15} />}{t.sendDeposit}</button>
            </form>
          )}
        </div> : <div className="financial-flow-body">
          <p>{t.withdrawHelp} {t.review}</p>
          {!wdOptions.length ? <div className="financial-not-configured"><ShieldCheck size={23} /><b>{t.noWithdraw}</b></div> : (
            <form className="financial-form" onSubmit={e => void submitWithdrawal(e)}>
              <label>{t.network}<select value={wdSelected} onChange={e => setWdSelected(e.target.value)} required>{wdOptions.map(o => <option key={optionKey(o.asset_code,o.network_code)} value={optionKey(o.asset_code,o.network_code)}>{o.asset_code} · {o.network_code}</option>)}</select></label>
              <label>{t.amount} ({t.coins})<input type="number" min="500" max="50000" step="1" value={wdAmount} onChange={e => setWdAmount(e.target.value)} required /></label>
              <label>{t.destination}<input value={wdAddress} onChange={e => setWdAddress(e.target.value)} minLength={20} maxLength={256} autoComplete="off" required /></label>
              <div className="financial-conversion"><span>{t.usd}</span><b>{"$"}{fmt(coinsToWithdraw / 100, locale, 2)}</b><span>{t.fee}</span><b>{fmt(fee, locale, 8)} {wdOption?.asset_code ?? ""}</b><span>{t.net}</span><b>{fmt(net, locale, 8)} {wdOption?.asset_code ?? ""}</b></div>
              <p className="financial-small-note">{t.min} · {t.feeNote}</p>
              <button className="financial-submit-btn" type="submit" disabled={busy || loading}><ArrowUpFromLine size={15} />{t.sendWithdraw}</button>
            </form>
          )}
        </div>}
        {error && <p className="financial-error" role="alert">{error}</p>}
      </section>
      <section className="financial-history-grid">
        <article className="financial-history-card"><h3><History size={15} />{t.deposits}</h3>
          {!depRows.length ? <p className="financial-empty-history">{t.empty}</p> : depRows.map(row => <div className="financial-history-row" key={row.id}><div><b>{fmt(row.coin_amount,locale)} {t.coins}</b><small>{row.asset_code} · {row.network_code} · {dateFmt(row.created_at,locale)}</small></div><span className={"financial-status status-"+row.status}>{statusText(row.status)}</span></div>)}
        </article>
        <article className="financial-history-card"><h3><Activity size={15} />{t.withdrawals}</h3>
          {!wdRows.length ? <p className="financial-empty-history">{t.empty}</p> : wdRows.map(row => <div className="financial-history-row" key={row.id}><div><b>{fmt(row.requested_coins,locale)} {t.coins}</b><small>{row.asset_code} · {row.network_code} · {dateFmt(row.created_at,locale)}</small></div><span className={"financial-status status-"+row.status}>{statusText(row.status)}</span></div>)}
        </article>
      </section>
      {loading && <div className="financial-loading"><LoaderCircle className="spin" size={15} />{t.loading}</div>}
    </section>
  );
}

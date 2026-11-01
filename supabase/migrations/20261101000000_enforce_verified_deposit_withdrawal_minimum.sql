-- Enforce the minimum cumulative credited real-deposit history before withdrawal.
-- Signup gifts, promotions, winnings and refunds never count: only credited
-- deposit_requests.coin_amount is included in this independent eligibility gate.
begin;

create or replace function public.request_withdrawal(
  p_requested_coins bigint,
  p_payout_address_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_flags public.member_gate_verifications;
  v_config public.withdrawal_network_configs;
  v_payout_address public.member_payout_addresses%rowtype;
  v_daily bigint;
  v_weekly bigint;
  v_turnover_remaining bigint;
  v_lifetime_deposit_coins bigint;
  v_usd numeric(30,12);
  v_gross numeric(30,12);
  v_net numeric(30,12);
  v_request_id uuid := gen_random_uuid();
  v_ledger_id uuid;
  v_wallet public.coin_wallets;
  v_idempotency text;
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  if p_requested_coins is null or p_requested_coins<500 or p_requested_coins>50000 or p_payout_address_id is null then
    raise exception 'invalid_withdrawal_request' using errcode='22023';
  end if;

  -- Serialize all withdrawal eligibility checks and reservations per member.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('withdrawal-limits:'||v_user_id::text,0)
  );

  select * into v_flags from public.member_gate_verifications where user_id=v_user_id;
  if not found or not v_flags.telegram_verified or not v_flags.phone_verified or not v_flags.wallet_verified then
    raise exception 'member_verification_incomplete' using errcode='42501';
  end if;

  select * into v_payout_address from public.member_payout_addresses a
  where a.id=p_payout_address_id and a.user_id=v_user_id and a.verification_status='verified';
  if not found then raise exception 'verified_payout_address_required' using errcode='42501'; end if;
  select * into v_config from public.withdrawal_network_configs
  where asset_code=v_payout_address.asset_code and network_code=v_payout_address.network_code and is_enabled=true;
  if not found then raise exception 'withdrawal_network_not_available' using errcode='22023'; end if;
  if exists(select 1 from public.withdrawal_requests w where w.user_id=v_user_id and w.status in ('pending','approved')) then
    raise exception 'pending_withdrawal_already_exists' using errcode='22023';
  end if;

  select coalesce(sum(l.turnover_required-l.turnover_completed),0)
  into v_turnover_remaining
  from public.paid_coin_lots l
  where l.user_id=v_user_id and l.source_type='deposit';
  if v_turnover_remaining>0 then
    raise exception 'deposit_turnover_incomplete' using errcode='22023';
  end if;

  -- Eligibility is based on cumulative, manually credited deposit history,
  -- not the current wallet balance. Signup gifts and non-deposit credits are excluded.
  select coalesce(sum(d.coin_amount),0)
  into v_lifetime_deposit_coins
  from public.deposit_requests d
  where d.user_id=v_user_id and d.status='credited';
  if v_lifetime_deposit_coins<500 then
    raise exception 'verified_deposit_history_below_minimum'
      using errcode='22023';
  end if;

  select coalesce(sum(w.requested_coins),0) into v_daily
  from public.withdrawal_requests w
  where w.user_id=v_user_id and w.created_at>=now()-interval '24 hours'
    and w.status in ('pending','approved','paid');
  if v_daily+p_requested_coins>50000 then
    raise exception 'daily_withdrawal_limit_exceeded' using errcode='22023';
  end if;

  select coalesce(sum(w.requested_coins),0) into v_weekly
  from public.withdrawal_requests w
  where w.user_id=v_user_id and w.created_at>=now()-interval '7 days'
    and w.status in ('pending','approved','paid');
  if v_weekly+p_requested_coins>350000 then
    raise exception 'weekly_withdrawal_limit_exceeded' using errcode='22023';
  end if;

  v_usd := p_requested_coins::numeric/100;
  v_gross := v_usd/v_config.usd_per_asset;
  v_net := v_gross-v_config.network_fee_asset;
  if v_net<=0 then raise exception 'withdrawal_less_than_network_fee' using errcode='22023'; end if;

  v_idempotency := 'withdrawal-reserve:'||v_request_id::text;
  update public.coin_wallets
  set purchased_coins=purchased_coins-p_requested_coins,updated_at=now()
  where user_id=v_user_id and purchased_coins>=p_requested_coins
  returning * into v_wallet;
  if not found then raise exception 'insufficient_value_wallet_balance' using errcode='23514'; end if;

  insert into public.coin_ledger(user_id,amount,bucket,event_type,reference_id,idempotency_key)
  values(v_user_id,-p_requested_coins,'purchased','withdrawal_reserve',v_request_id::text,v_idempotency);
  select id into v_ledger_id from public.coin_ledger where idempotency_key=v_idempotency;

  insert into public.withdrawal_requests(
    id,user_id,requested_coins,asset_code,network_code,destination_address,
    usd_per_asset_snapshot,coins_per_usd_snapshot,gross_asset_amount,
    network_fee_asset_amount,net_asset_amount,status,reserve_ledger_id
  )
  values(
    v_request_id,v_user_id,p_requested_coins,v_payout_address.asset_code,v_payout_address.network_code,v_payout_address.wallet_address,
    v_config.usd_per_asset,100,v_gross,v_config.network_fee_asset,v_net,'pending',v_ledger_id
  );

  return v_request_id;
end;
$$;

revoke all on function public.request_withdrawal(bigint,uuid) from public,anon;
grant execute on function public.request_withdrawal(bigint,uuid) to authenticated;

comment on function public.request_withdrawal(bigint,uuid) is
  'Creates a manual withdrawal request only after completed deposit turnover and at least 500 cumulative credited real-deposit coins. Signup gifts and other credits do not satisfy deposit history.';

commit;

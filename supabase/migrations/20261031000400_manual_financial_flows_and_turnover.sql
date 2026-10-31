-- Manual crypto deposits, duplicate transaction claims, Value Wallet provenance,
-- deposit-only 20% turnover, manual withdrawals and verification gates.
begin;

-- Network configuration is private; users receive a read-only projection via RPC.
create table if not exists public.deposit_network_configs (
  asset_code text not null check (asset_code ~ '^[A-Z0-9]{2,10}$'),
  network_code text not null check (network_code ~ '^[A-Z0-9_-]{2,24}$'),
  deposit_address text not null check (char_length(btrim(deposit_address)) between 10 and 256),
  usd_per_asset numeric(30,12) not null check (usd_per_asset > 0),
  coins_per_usd integer not null default 100 check (coins_per_usd = 100),
  min_amount numeric(30,12) not null default 0.00000001 check (min_amount > 0),
  hash_case_insensitive boolean not null default true,
  is_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key(asset_code,network_code)
);

create table if not exists public.withdrawal_network_configs (
  asset_code text not null check (asset_code ~ '^[A-Z0-9]{2,10}$'),
  network_code text not null check (network_code ~ '^[A-Z0-9_-]{2,24}$'),
  usd_per_asset numeric(30,12) not null check (usd_per_asset > 0),
  network_fee_asset numeric(30,12) not null default 0 check (network_fee_asset >= 0),
  is_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key(asset_code,network_code)
);

alter table public.deposit_requests
  add column if not exists usd_value numeric(30,12) not null default 0 check (usd_value >= 0),
  add column if not exists coin_amount bigint not null default 0 check (coin_amount >= 0),
  add column if not exists destination_address_snapshot text,
  add column if not exists transaction_at timestamptz,
  add column if not exists usd_per_asset_snapshot numeric(30,12),
  add column if not exists coins_per_usd_snapshot integer not null default 100,
  add column if not exists duplicate_of_request_id uuid references public.deposit_requests(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists review_note text,
  add column if not exists credited_ledger_id uuid references public.coin_ledger(id) on delete set null;

drop index if exists public.deposit_requests_tx_hash_unique;
alter table public.deposit_requests drop constraint if exists deposit_requests_status_check;
alter table public.deposit_requests
  add constraint deposit_requests_status_check
  check (status in ('created','pending_confirmation','under_review','credited','rejected','expired','duplicate'));

create index if not exists deposit_requests_user_created_idx
  on public.deposit_requests(user_id,created_at desc);
create index if not exists deposit_requests_review_queue_idx
  on public.deposit_requests(status,created_at)
  where status in ('under_review','pending_confirmation');

create table if not exists public.deposit_tx_first_claims (
  asset_code text not null,
  network_code text not null,
  tx_hash_key text not null,
  first_request_id uuid not null references public.deposit_requests(id) on delete cascade,
  first_user_id uuid not null references auth.users(id) on delete cascade,
  first_claimed_at timestamptz not null default now(),
  primary key(asset_code,network_code,tx_hash_key)
);

create table if not exists public.deposit_tx_duplicate_attempts (
  id uuid primary key default gen_random_uuid(),
  duplicate_request_id uuid not null unique references public.deposit_requests(id) on delete cascade,
  first_request_id uuid not null references public.deposit_requests(id) on delete cascade,
  attempted_by uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

-- Verification flags are independent of KYC. Only trusted server-side workflows
-- can update them; users can read their own state.
create table if not exists public.member_gate_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  telegram_verified boolean not null default false,
  phone_verified boolean not null default false,
  wallet_verified boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create or replace function public.create_member_gate_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.member_gate_verifications(user_id)
  values(new.user_id)
  on conflict(user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_member_gate_verification() from public,anon,authenticated;
drop trigger if exists member_profile_seed_gate_verification on public.member_profiles;
create trigger member_profile_seed_gate_verification
after insert on public.member_profiles
for each row execute function public.create_member_gate_verification();

insert into public.member_gate_verifications(user_id)
select user_id from public.member_profiles
on conflict(user_id) do nothing;

-- Provenance lots are not additional wallets. They reconcile every Value Wallet
-- credit/debit to its origin so a signup gift cannot satisfy deposit turnover.
create table if not exists public.paid_coin_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_ledger_id uuid not null unique references public.coin_ledger(id) on delete cascade,
  source_type text not null check (source_type in ('signup_gift','deposit','winnings','refund','adjustment')),
  reference_id text,
  original_coins bigint not null check (original_coins > 0),
  remaining_coins bigint not null check (remaining_coins >= 0 and remaining_coins <= original_coins),
  turnover_required bigint not null default 0 check (turnover_required >= 0),
  turnover_completed bigint not null default 0 check (turnover_completed >= 0 and turnover_completed <= turnover_required),
  created_at timestamptz not null default now()
);
create index if not exists paid_coin_lots_fifo_idx
  on public.paid_coin_lots(user_id,created_at,id)
  where remaining_coins > 0;
create index if not exists paid_coin_lots_turnover_idx
  on public.paid_coin_lots(user_id,source_type,turnover_required,turnover_completed);

create table if not exists public.paid_coin_lot_consumptions (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.coin_ledger(id) on delete cascade,
  lot_id uuid not null references public.paid_coin_lots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount > 0),
  event_type text not null,
  match_id uuid references public.matches(id) on delete set null,
  qualifies_for_turnover boolean not null default false,
  turnover_counted bigint not null default 0 check (turnover_counted >= 0 and turnover_counted <= amount),
  turnover_applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique(ledger_id,lot_id)
);
create index if not exists paid_coin_consumptions_match_idx
  on public.paid_coin_lot_consumptions(match_id,user_id)
  where qualifies_for_turnover;

-- Backfill the already issued signup gift in the Value Wallet.
insert into public.paid_coin_lots(
  user_id,credit_ledger_id,source_type,reference_id,original_coins,remaining_coins,
  turnover_required,turnover_completed,created_at
)
select
  l.user_id,l.id,
  case
    when l.event_type='purchase' then 'deposit'
    when l.event_type='signup_bonus'
      or l.idempotency_key like 'signup_paid_conversion_credit:%'
      or l.reference_id like 'Move untouched legacy signup gift to the Value Wallet%'
      then 'signup_gift'
    when l.event_type='match_payout' then 'winnings'
    when l.event_type in ('match_refund','withdrawal_refund') then 'refund'
    else 'adjustment'
  end,
  l.reference_id,l.amount,l.amount,
  case when l.event_type='purchase' then ceil(l.amount::numeric*0.20)::bigint else 0 end,
  0,l.created_at
from public.coin_ledger l
where l.bucket='purchased' and l.amount>0
on conflict(credit_ledger_id) do nothing;

-- Extend the immutable wallet ledger vocabulary for manual withdrawal reservations
-- and refunds, and preserve one privileged mutation entry point.
alter table public.coin_ledger drop constraint if exists coin_ledger_event_type_check;
alter table public.coin_ledger
  add constraint coin_ledger_event_type_check check (
    event_type = any(array[
      'signup_bonus','purchase','match_entry','match_refund','tournament_reward',
      'admin_adjustment','promotion','reversal','withdrawal_reserve',
      'withdrawal_refund','match_payout'
    ])
  );

create or replace function public.sync_paid_coin_lots_from_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source text;
  v_remaining bigint;
  v_lot public.paid_coin_lots;
  v_take bigint;
  v_match_id uuid;
begin
  if new.bucket <> 'purchased' then
    return new;
  end if;

  if new.amount > 0 then
    v_source := case
      when new.event_type='purchase' then 'deposit'
      when new.event_type='signup_bonus'
        or new.idempotency_key like 'signup_paid_conversion_credit:%'
        or new.reference_id like 'Move untouched legacy signup gift to the Value Wallet%'
        then 'signup_gift'
      when new.event_type='match_payout' then 'winnings'
      when new.event_type in ('match_refund','withdrawal_refund') then 'refund'
      else 'adjustment'
    end;

    insert into public.paid_coin_lots(
      user_id,credit_ledger_id,source_type,reference_id,original_coins,remaining_coins,
      turnover_required,turnover_completed
    )
    values(
      new.user_id,new.id,v_source,new.reference_id,new.amount,new.amount,
      case when v_source='deposit' then ceil(new.amount::numeric*0.20)::bigint else 0 end,
      0
    )
    on conflict(credit_ledger_id) do nothing;
    return new;
  end if;

  if new.amount < 0 then
    if new.event_type='match_entry' then
      if new.reference_id is null
         or new.reference_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then
        raise exception 'paid_match_entry_requires_match_reference' using errcode='22023';
      end if;
      v_match_id := new.reference_id::uuid;
    else
      v_match_id := null;
    end if;

    v_remaining := -new.amount;
    for v_lot in
      select l.*
      from public.paid_coin_lots l
      where l.user_id=new.user_id and l.remaining_coins>0
      order by l.created_at,l.id
      for update
    loop
      exit when v_remaining=0;
      v_take := least(v_lot.remaining_coins,v_remaining);
      update public.paid_coin_lots
      set remaining_coins=remaining_coins-v_take
      where id=v_lot.id;

      insert into public.paid_coin_lot_consumptions(
        ledger_id,lot_id,user_id,amount,event_type,match_id,qualifies_for_turnover
      )
      values(
        new.id,v_lot.id,new.user_id,v_take,new.event_type,v_match_id,
        new.event_type='match_entry' and v_lot.source_type='deposit'
      );

      v_remaining := v_remaining-v_take;
    end loop;

    if v_remaining>0 then
      raise exception 'paid_coin_lot_balance_mismatch' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_paid_coin_lots_from_ledger() from public,anon,authenticated;
drop trigger if exists coin_ledger_sync_paid_coin_lots on public.coin_ledger;
create trigger coin_ledger_sync_paid_coin_lots
after insert on public.coin_ledger
for each row execute function public.sync_paid_coin_lots_from_ledger();

-- Every approved Value Wallet credit/debit is idempotent and reflected in provenance.
create or replace function public.apply_coin_delta(
  p_user_id uuid,
  p_bucket text,
  p_amount bigint,
  p_event_type text,
  p_idempotency_key text,
  p_reference_id text default null
)
returns public.coin_wallets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet public.coin_wallets;
  v_existing public.coin_ledger;
begin
  if coalesce(auth.role(),'anon') <> 'service_role' then
    raise exception 'not_authorized' using errcode='42501';
  end if;

  if p_user_id is null
     or p_bucket not in ('free','purchased','reward')
     or p_event_type not in (
       'signup_bonus','purchase','match_entry','match_refund','tournament_reward',
       'admin_adjustment','promotion','reversal','withdrawal_reserve',
       'withdrawal_refund','match_payout'
     )
     or p_amount=0 or p_amount < -1000000000 or p_amount > 1000000000
     or p_idempotency_key is null
     or char_length(p_idempotency_key)<8 or char_length(p_idempotency_key)>200
     or (p_reference_id is not null and char_length(p_reference_id)>200)
  then
    raise exception 'invalid_wallet_operation' using errcode='22023';
  end if;

  if (p_event_type in ('signup_bonus','purchase','match_refund','tournament_reward','promotion','withdrawal_refund','match_payout') and p_amount<0)
     or (p_event_type in ('match_entry','withdrawal_reserve') and p_amount>0)
     or (p_event_type='purchase' and p_bucket<>'purchased')
     or (p_event_type='signup_bonus' and p_bucket not in ('free','purchased'))
     or (p_event_type in ('withdrawal_reserve','withdrawal_refund','match_payout') and p_bucket<>'purchased')
  then
    raise exception 'invalid_wallet_event_direction' using errcode='22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key,0));

  select * into v_existing from public.coin_ledger where idempotency_key=p_idempotency_key;
  if found then
    if v_existing.user_id<>p_user_id
       or v_existing.bucket<>p_bucket
       or v_existing.amount<>p_amount
       or v_existing.event_type<>p_event_type
       or v_existing.reference_id is distinct from p_reference_id
    then
      raise exception 'idempotency_key_conflict' using errcode='23505';
    end if;
    select * into v_wallet from public.coin_wallets where user_id=p_user_id;
    if not found then raise exception 'wallet_not_found' using errcode='P0002'; end if;
    return v_wallet;
  end if;

  select * into v_wallet from public.coin_wallets where user_id=p_user_id for update;
  if not found then raise exception 'wallet_not_found' using errcode='P0002'; end if;

  update public.coin_wallets
  set free_coins=case when p_bucket='free' then free_coins+p_amount else free_coins end,
      purchased_coins=case when p_bucket='purchased' then purchased_coins+p_amount else purchased_coins end,
      reward_coins=case when p_bucket='reward' then reward_coins+p_amount else reward_coins end,
      updated_at=now()
  where user_id=p_user_id
    and (
      (p_bucket='free' and free_coins+p_amount>=0)
      or (p_bucket='purchased' and purchased_coins+p_amount>=0)
      or (p_bucket='reward' and reward_coins+p_amount>=0)
    )
  returning * into v_wallet;

  if not found then raise exception 'insufficient_coin_balance' using errcode='23514'; end if;

  insert into public.coin_ledger(user_id,amount,bucket,event_type,reference_id,idempotency_key)
  values(p_user_id,p_amount,p_bucket,p_event_type,p_reference_id,p_idempotency_key);

  return v_wallet;
end;
$$;
revoke all on function public.apply_coin_delta(uuid,text,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.apply_coin_delta(uuid,text,bigint,text,text,text) to service_role;

-- Admin-managed verification and financial destination settings.
create or replace function public.set_member_gate_verification(
  p_user_id uuid,p_telegram_verified boolean,p_phone_verified boolean,p_wallet_verified boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(),'anon')<>'service_role' then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  insert into public.member_gate_verifications(user_id,telegram_verified,phone_verified,wallet_verified,updated_at,updated_by)
  values(p_user_id,p_telegram_verified,p_phone_verified,p_wallet_verified,now(),null)
  on conflict(user_id) do update
  set telegram_verified=excluded.telegram_verified,
      phone_verified=excluded.phone_verified,
      wallet_verified=excluded.wallet_verified,
      updated_at=now(),updated_by=null;
end;
$$;
revoke all on function public.set_member_gate_verification(uuid,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.set_member_gate_verification(uuid,boolean,boolean,boolean) to service_role;

create or replace function public.get_deposit_options()
returns table(asset_code text,network_code text,deposit_address text,usd_per_asset numeric,coins_per_usd integer,min_amount numeric)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  return query
  select c.asset_code,c.network_code,c.deposit_address,c.usd_per_asset,c.coins_per_usd,c.min_amount
  from public.deposit_network_configs c
  where c.is_enabled=true
  order by c.asset_code,c.network_code;
end;
$$;
revoke all on function public.get_deposit_options() from public,anon;
grant execute on function public.get_deposit_options() to authenticated;

create or replace function public.get_withdrawal_options()
returns table(asset_code text,network_code text,usd_per_asset numeric,network_fee_asset numeric)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  return query
  select c.asset_code,c.network_code,c.usd_per_asset,c.network_fee_asset
  from public.withdrawal_network_configs c
  where c.is_enabled=true
  order by c.asset_code,c.network_code;
end;
$$;
revoke all on function public.get_withdrawal_options() from public,anon;
grant execute on function public.get_withdrawal_options() to authenticated;

create or replace function public.submit_deposit_claim(
  p_asset_code text,p_network_code text,p_amount numeric,p_tx_hash text,p_transaction_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_config public.deposit_network_configs;
  v_hash_key text;
  v_existing public.deposit_tx_first_claims;
  v_request_id uuid;
  v_usd_value numeric(30,12);
  v_coins bigint;
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  if p_asset_code is null or p_network_code is null
     or p_amount is null or p_amount<=0 or p_amount>1000000000
     or p_tx_hash is null or char_length(btrim(p_tx_hash))<16 or char_length(btrim(p_tx_hash))>256
     or p_tx_hash ~ '[[:space:]]'
     or p_transaction_at is null
     or p_transaction_at>now()+interval '5 minutes'
     or p_transaction_at<now()-interval '30 days'
  then
    raise exception 'invalid_deposit_claim' using errcode='22023';
  end if;

  select * into v_config
  from public.deposit_network_configs
  where asset_code=p_asset_code and network_code=p_network_code and is_enabled=true;
  if not found then raise exception 'deposit_network_not_available' using errcode='22023'; end if;
  if p_amount<v_config.min_amount then raise exception 'deposit_amount_below_network_minimum' using errcode='22023'; end if;

  v_usd_value := round(p_amount*v_config.usd_per_asset,12);
  v_coins := round(v_usd_value*v_config.coins_per_usd)::bigint;
  if v_coins<1 or v_coins>1000000000 then
    raise exception 'deposit_value_out_of_range' using errcode='22023';
  end if;

  v_hash_key := case when v_config.hash_case_insensitive then lower(btrim(p_tx_hash)) else btrim(p_tx_hash) end;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_asset_code||':'||p_network_code||':'||v_hash_key,0)
  );

  select * into v_existing
  from public.deposit_tx_first_claims
  where asset_code=p_asset_code and network_code=p_network_code and tx_hash_key=v_hash_key
  for update;

  if found then
    if v_existing.first_user_id=v_user_id then
      return v_existing.first_request_id;
    end if;

    insert into public.deposit_requests(
      user_id,asset_code,network_code,expected_amount,tx_hash,status,confirmations,
      usd_value,coin_amount,destination_address_snapshot,transaction_at,
      usd_per_asset_snapshot,coins_per_usd_snapshot,duplicate_of_request_id
    )
    values(
      v_user_id,p_asset_code,p_network_code,p_amount,v_hash_key,'duplicate',0,
      v_usd_value,v_coins,v_config.deposit_address,p_transaction_at,
      v_config.usd_per_asset,v_config.coins_per_usd,v_existing.first_request_id
    )
    returning id into v_request_id;

    insert into public.deposit_tx_duplicate_attempts(duplicate_request_id,first_request_id,attempted_by)
    values(v_request_id,v_existing.first_request_id,v_user_id);
    return v_request_id;
  end if;

  insert into public.deposit_requests(
    user_id,asset_code,network_code,expected_amount,tx_hash,status,confirmations,
    usd_value,coin_amount,destination_address_snapshot,transaction_at,
    usd_per_asset_snapshot,coins_per_usd_snapshot
  )
  values(
    v_user_id,p_asset_code,p_network_code,p_amount,v_hash_key,'under_review',0,
    v_usd_value,v_coins,v_config.deposit_address,p_transaction_at,
    v_config.usd_per_asset,v_config.coins_per_usd
  )
  returning id into v_request_id;

  insert into public.deposit_tx_first_claims(
    asset_code,network_code,tx_hash_key,first_request_id,first_user_id
  )
  values(p_asset_code,p_network_code,v_hash_key,v_request_id,v_user_id);

  return v_request_id;
end;
$$;
revoke all on function public.submit_deposit_claim(text,text,numeric,text,timestamptz) from public,anon;
grant execute on function public.submit_deposit_claim(text,text,numeric,text,timestamptz) to authenticated;

create or replace function public.review_deposit_request(
  p_request_id uuid,p_approve boolean,p_review_note text default null
)
returns public.deposit_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.deposit_requests;
  v_ledger_id uuid;
begin
  if coalesce(auth.role(),'anon')<>'service_role' then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  select * into v_request from public.deposit_requests where id=p_request_id for update;
  if not found then raise exception 'deposit_request_not_found' using errcode='P0002'; end if;
  if v_request.status<>'under_review' then
    raise exception 'deposit_request_already_reviewed' using errcode='22023';
  end if;

  if p_approve then
    perform public.apply_coin_delta(
      v_request.user_id,'purchased',v_request.coin_amount,'purchase',
      'deposit-credit:'||v_request.id::text,v_request.id::text
    );
    select id into v_ledger_id from public.coin_ledger
    where idempotency_key='deposit-credit:'||v_request.id::text;

    update public.deposit_requests
    set status='credited',credited_at=now(),reviewed_at=now(),reviewed_by=null,
        review_note=left(coalesce(p_review_note,''),1000),credited_ledger_id=v_ledger_id,updated_at=now()
    where id=p_request_id returning * into v_request;
  else
    update public.deposit_requests
    set status='rejected',reviewed_at=now(),reviewed_by=null,
        review_note=left(coalesce(p_review_note,''),1000),updated_at=now()
    where id=p_request_id returning * into v_request;
  end if;
  return v_request;
end;
$$;
revoke all on function public.review_deposit_request(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.review_deposit_request(uuid,boolean,text) to service_role;

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_coins bigint not null check (requested_coins>=500 and requested_coins<=50000),
  asset_code text not null check (asset_code ~ '^[A-Z0-9]{2,10}$'),
  network_code text not null check (network_code ~ '^[A-Z0-9_-]{2,24}$'),
  destination_address text not null check (char_length(btrim(destination_address)) between 20 and 256),
  usd_per_asset_snapshot numeric(30,12) not null check (usd_per_asset_snapshot>0),
  coins_per_usd_snapshot integer not null default 100 check (coins_per_usd_snapshot=100),
  gross_asset_amount numeric(30,12) not null check (gross_asset_amount>0),
  network_fee_asset_amount numeric(30,12) not null check (network_fee_asset_amount>=0),
  net_asset_amount numeric(30,12) not null check (net_asset_amount>0),
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  reserve_ledger_id uuid references public.coin_ledger(id) on delete set null,
  payout_tx_hash text,
  actual_asset_amount numeric(30,12) check (actual_asset_amount is null or actual_asset_amount>0),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz,
  review_note text,
  updated_at timestamptz not null default now()
);
create index if not exists withdrawal_requests_user_created_idx
  on public.withdrawal_requests(user_id,created_at desc);
create index if not exists withdrawal_requests_queue_idx
  on public.withdrawal_requests(status,created_at)
  where status in ('pending','approved');
create unique index if not exists withdrawal_payout_tx_unique
  on public.withdrawal_requests(asset_code,network_code,lower(payout_tx_hash))
  where payout_tx_hash is not null;

alter table public.withdrawal_requests enable row level security;
revoke all on public.withdrawal_requests from anon,authenticated;
grant select on public.withdrawal_requests to authenticated;
drop policy if exists "members see own withdrawal requests" on public.withdrawal_requests;
create policy "members see own withdrawal requests"
on public.withdrawal_requests for select
to authenticated
using ((select auth.uid())=user_id);

alter table public.member_gate_verifications enable row level security;
revoke all on public.member_gate_verifications from anon,authenticated;
grant select on public.member_gate_verifications to authenticated;
drop policy if exists "members see own gate verification" on public.member_gate_verifications;
create policy "members see own gate verification"
on public.member_gate_verifications for select
to authenticated
using ((select auth.uid())=user_id);

alter table public.deposit_network_configs enable row level security;
alter table public.withdrawal_network_configs enable row level security;
alter table public.deposit_tx_first_claims enable row level security;
alter table public.deposit_tx_duplicate_attempts enable row level security;
alter table public.paid_coin_lots enable row level security;
alter table public.paid_coin_lot_consumptions enable row level security;

revoke all on public.deposit_network_configs from public,anon,authenticated;
revoke all on public.withdrawal_network_configs from public,anon,authenticated;
revoke all on public.deposit_tx_first_claims from public,anon,authenticated;
revoke all on public.deposit_tx_duplicate_attempts from public,anon,authenticated;
revoke all on public.paid_coin_lots from public,anon,authenticated;
revoke all on public.paid_coin_lot_consumptions from public,anon,authenticated;

create or replace function public.request_withdrawal(
  p_requested_coins bigint,p_asset_code text,p_network_code text,p_destination_address text
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
  v_daily bigint;
  v_weekly bigint;
  v_turnover_remaining bigint;
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
  if p_requested_coins is null or p_requested_coins<500 or p_requested_coins>50000
     or p_destination_address is null or char_length(btrim(p_destination_address))<20
     or char_length(btrim(p_destination_address))>256
  then
    raise exception 'invalid_withdrawal_request' using errcode='22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('withdrawal-limits:'||v_user_id::text,0)
  );

  select * into v_flags from public.member_gate_verifications where user_id=v_user_id;
  if not found or not v_flags.telegram_verified or not v_flags.phone_verified or not v_flags.wallet_verified then
    raise exception 'member_verification_incomplete' using errcode='42501';
  end if;

  select * into v_config
  from public.withdrawal_network_configs
  where asset_code=p_asset_code and network_code=p_network_code and is_enabled=true;
  if not found then raise exception 'withdrawal_network_not_available' using errcode='22023'; end if;

  select coalesce(sum(l.turnover_required-l.turnover_completed),0)
  into v_turnover_remaining
  from public.paid_coin_lots l
  where l.user_id=v_user_id and l.source_type='deposit';
  if v_turnover_remaining>0 then
    raise exception 'deposit_turnover_incomplete' using errcode='22023';
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
    v_request_id,v_user_id,p_requested_coins,p_asset_code,p_network_code,btrim(p_destination_address),
    v_config.usd_per_asset,100,v_gross,v_config.network_fee_asset,v_net,'pending',v_ledger_id
  );

  return v_request_id;
end;
$$;
revoke all on function public.request_withdrawal(bigint,text,text,text) from public,anon;
grant execute on function public.request_withdrawal(bigint,text,text,text) to authenticated;

create or replace function public.review_withdrawal_request(
  p_request_id uuid,p_action text,p_payout_tx_hash text default null,p_actual_asset_amount numeric default null,p_review_note text default null
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.withdrawal_requests;
begin
  if coalesce(auth.role(),'anon')<>'service_role' then
    raise exception 'not_authorized' using errcode='42501';
  end if;

  select * into v_request from public.withdrawal_requests where id=p_request_id for update;
  if not found then raise exception 'withdrawal_request_not_found' using errcode='P0002'; end if;

  if p_action='approve' then
    if v_request.status<>'pending' then raise exception 'withdrawal_not_pending' using errcode='22023'; end if;
    update public.withdrawal_requests
    set status='approved',reviewed_at=now(),review_note=left(coalesce(p_review_note,''),1000),updated_at=now()
    where id=p_request_id returning * into v_request;
  elsif p_action='reject' then
    if v_request.status not in ('pending','approved') then raise exception 'withdrawal_not_rejectable' using errcode='22023'; end if;
    perform public.apply_coin_delta(
      v_request.user_id,'purchased',v_request.requested_coins,'withdrawal_refund',
      'withdrawal-refund:'||v_request.id::text,v_request.id::text
    );
    update public.withdrawal_requests
    set status='rejected',reviewed_at=now(),review_note=left(coalesce(p_review_note,''),1000),updated_at=now()
    where id=p_request_id returning * into v_request;
  elsif p_action='paid' then
    if v_request.status<>'approved'
       or p_payout_tx_hash is null or char_length(btrim(p_payout_tx_hash))<16
       or char_length(btrim(p_payout_tx_hash))>256
       or p_payout_tx_hash ~ '[[:space:]]'
       or p_actual_asset_amount is null or p_actual_asset_amount<=0
    then
      raise exception 'invalid_withdrawal_payout' using errcode='22023';
    end if;
    update public.withdrawal_requests
    set status='paid',payout_tx_hash=btrim(p_payout_tx_hash),actual_asset_amount=p_actual_asset_amount,
        paid_at=now(),reviewed_at=coalesce(reviewed_at,now()),
        review_note=left(coalesce(p_review_note,''),1000),updated_at=now()
    where id=p_request_id returning * into v_request;
  else
    raise exception 'invalid_withdrawal_action' using errcode='22023';
  end if;
  return v_request;
end;
$$;
revoke all on function public.review_withdrawal_request(uuid,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.review_withdrawal_request(uuid,text,text,numeric,text) to service_role;

create or replace function public.complete_paid_match_turnover(p_match_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
  v_consumption public.paid_coin_lot_consumptions;
  v_lot public.paid_coin_lots;
  v_add bigint;
  v_total bigint := 0;
begin
  if coalesce(auth.role(),'anon')<>'service_role' then
    raise exception 'not_authorized' using errcode='42501';
  end if;

  select * into v_match from public.matches where id=p_match_id for update;
  if not found or v_match.economy_mode<>'paid' or v_match.status<>'completed' then
    raise exception 'paid_match_not_completed' using errcode='22023';
  end if;
  if exists(
    select 1 from public.match_participants
    where match_id=p_match_id and (final_result is null or final_result='forfeit')
  ) then
    raise exception 'match_result_not_eligible_for_turnover' using errcode='22023';
  end if;
  if (select count(*) from public.match_participants where match_id=p_match_id)<2 then
    raise exception 'match_participants_incomplete' using errcode='22023';
  end if;

  for v_consumption in
    select * from public.paid_coin_lot_consumptions
    where match_id=p_match_id and qualifies_for_turnover=true and turnover_applied_at is null
    order by created_at,id
    for update
  loop
    select * into v_lot from public.paid_coin_lots where id=v_consumption.lot_id for update;
    v_add := least(v_consumption.amount,greatest(0,v_lot.turnover_required-v_lot.turnover_completed));
    update public.paid_coin_lots
    set turnover_completed=turnover_completed+v_add
    where id=v_lot.id;
    update public.paid_coin_lot_consumptions
    set turnover_counted=v_add,turnover_applied_at=now()
    where id=v_consumption.id;
    v_total := v_total+v_add;
  end loop;
  return v_total;
end;
$$;
revoke all on function public.complete_paid_match_turnover(uuid) from public,anon,authenticated;
grant execute on function public.complete_paid_match_turnover(uuid) to service_role;

create or replace function public.get_my_financial_summary()
returns table(
  lifetime_deposit_coins bigint,
  turnover_required bigint,
  turnover_completed bigint,
  turnover_remaining bigint,
  value_wallet_coins bigint,
  daily_withdrawal_remaining bigint,
  weekly_withdrawal_remaining bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_daily bigint;
  v_weekly bigint;
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'not_authorized' using errcode='42501';
  end if;

  select coalesce(sum(coin_amount),0) into lifetime_deposit_coins
  from public.deposit_requests where user_id=v_user_id and status='credited';

  select coalesce(sum(l.turnover_required),0),coalesce(sum(l.turnover_completed),0)
  into turnover_required,turnover_completed
  from public.paid_coin_lots l where l.user_id=v_user_id and l.source_type='deposit';
  turnover_remaining := greatest(0,turnover_required-turnover_completed);

  select purchased_coins into value_wallet_coins
  from public.coin_wallets where user_id=v_user_id;

  select coalesce(sum(requested_coins),0) into v_daily
  from public.withdrawal_requests
  where user_id=v_user_id and created_at>=now()-interval '24 hours'
    and status in ('pending','approved','paid');
  select coalesce(sum(requested_coins),0) into v_weekly
  from public.withdrawal_requests
  where user_id=v_user_id and created_at>=now()-interval '7 days'
    and status in ('pending','approved','paid');

  daily_withdrawal_remaining := greatest(0,50000-v_daily);
  weekly_withdrawal_remaining := greatest(0,350000-v_weekly);
  return next;
end;
$$;
revoke all on function public.get_my_financial_summary() from public,anon;
grant execute on function public.get_my_financial_summary() to authenticated;

create or replace function public.get_member_game_access(p_game_id text)
returns table(
  free_level integer,
  paid_level integer,
  lifetime_deposit_coins bigint,
  telegram_verified boolean,
  phone_verified boolean,
  wallet_verified boolean,
  paid_random_unlocked boolean,
  paid_private_unlocked boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_free_xp bigint;
  v_paid_xp bigint;
  v_verified public.member_gate_verifications;
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  if not exists(select 1 from public.catalog_games where id=p_game_id) then
    raise exception 'game_not_found' using errcode='22023';
  end if;

  select coalesce(max(xp) filter(where economy_mode='free'),0),
         coalesce(max(xp) filter(where economy_mode='paid'),0)
  into v_free_xp,v_paid_xp
  from public.member_game_stats where user_id=v_user_id and game_id=p_game_id;

  free_level := coalesce((select max(level_no) from generate_series(1,1000) as level_no
                          where 25*(level_no-1)*(level_no+2)<=v_free_xp),1);
  paid_level := coalesce((select max(level_no) from generate_series(1,1000) as level_no
                          where 25*(level_no-1)*(level_no+2)<=v_paid_xp),1);

  select coalesce(sum(coin_amount),0) into lifetime_deposit_coins
  from public.deposit_requests where user_id=v_user_id and status='credited';

  select * into v_verified from public.member_gate_verifications where user_id=v_user_id;
  telegram_verified := coalesce(v_verified.telegram_verified,false);
  phone_verified := coalesce(v_verified.phone_verified,false);
  wallet_verified := coalesce(v_verified.wallet_verified,false);

  paid_random_unlocked := free_level>=5 and telegram_verified and phone_verified and wallet_verified;
  paid_private_unlocked := paid_level>=5 and lifetime_deposit_coins>=500
                           and telegram_verified and phone_verified and wallet_verified;
  return next;
end;
$$;
revoke all on function public.get_member_game_access(text) from public,anon;
grant execute on function public.get_member_game_access(text) to authenticated;

alter table public.member_gate_verifications enable row level security;
alter table public.deposit_requests enable row level security;

comment on table public.paid_coin_lots is
  'Provenance inside the Value Wallet; these rows are not additional wallet balances.';
comment on table public.paid_coin_lot_consumptions is
  'Records which Value Wallet source funded each debit; only completed paid-match stakes from deposit lots satisfy 20% turnover.';
comment on column public.deposit_requests.coin_amount is
  'Coins calculated at the request-time snapshot rate: 100 coins per USD.';
comment on table public.deposit_tx_first_claims is
  'First claimant owns a chain-specific transaction hash permanently, including when manual review later rejects the request.';

commit;

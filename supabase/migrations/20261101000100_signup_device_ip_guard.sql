-- Signup abuse controls:
-- 1. Bind one account to each persistent app-install identifier.
-- 2. Limit new accounts created from one source IP to three per rolling 24 hours.
-- IP addresses are HMACed with a database-held pepper; raw IP addresses are never stored.
-- Browser install IDs are identifiers, not hardware attestation; native attestation remains a later hardening step.
begin;

create schema if not exists private;
revoke all on schema private from public,anon,authenticated,service_role;
grant usage on schema private to supabase_auth_admin;

-- A private pepper lets the hook create stable, non-reversible IP fingerprints.
create table if not exists private.signup_guard_secrets (
  singleton boolean primary key default true check(singleton),
  hmac_pepper bytea not null check(octet_length(hmac_pepper)=32),
  created_at timestamptz not null default now()
);
alter table private.signup_guard_secrets enable row level security;
revoke all on private.signup_guard_secrets from public,anon,authenticated,service_role;
grant select on private.signup_guard_secrets to supabase_auth_admin;
drop policy if exists signup_guard_secret_auth_read on private.signup_guard_secrets;
create policy signup_guard_secret_auth_read
  on private.signup_guard_secrets
  for select to supabase_auth_admin
  using (true);
insert into private.signup_guard_secrets(singleton,hmac_pepper)
values(true,extensions.gen_random_bytes(32))
on conflict(singleton) do nothing;

-- Device rows are keyed by a SHA-256 digest of a random UUID stored by the app.
-- One member may use multiple devices; a single device cannot be claimed by
-- two different member accounts. The FK releases the claim when the account is deleted.
create table if not exists private.signup_device_claims (
  device_hash bytea primary key check(octet_length(device_hash)=32),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists signup_device_claims_user_idx
  on private.signup_device_claims(user_id,last_seen_at desc);
alter table private.signup_device_claims enable row level security;
revoke all on private.signup_device_claims from public,anon,authenticated,service_role;
grant select on private.signup_device_claims to supabase_auth_admin;
drop policy if exists signup_device_claims_auth_read on private.signup_device_claims;
create policy signup_device_claims_auth_read
  on private.signup_device_claims
  for select to supabase_auth_admin
  using (true);

-- IP attempts are retained as HMAC fingerprints for 30 days to support a
-- rolling signup quota without storing direct IP addresses.
create table if not exists private.signup_ip_attempts (
  user_id uuid primary key,
  ip_hash bytea not null check(octet_length(ip_hash)=32),
  created_at timestamptz not null default now()
);
create index if not exists signup_ip_attempts_ip_created_idx
  on private.signup_ip_attempts(ip_hash,created_at desc);
alter table private.signup_ip_attempts enable row level security;
revoke all on private.signup_ip_attempts from public,anon,authenticated,service_role;
grant select,insert,delete on private.signup_ip_attempts to supabase_auth_admin;
drop policy if exists signup_ip_attempts_auth_all on private.signup_ip_attempts;
create policy signup_ip_attempts_auth_all
  on private.signup_ip_attempts
  for all to supabase_auth_admin
  using (true)
  with check (true);

grant usage on schema public to supabase_auth_admin;
grant usage on schema extensions to supabase_auth_admin;
grant execute on function extensions.hmac(bytea,bytea,text) to supabase_auth_admin;
grant execute on function extensions.digest(bytea,text) to supabase_auth_admin;

create or replace function public.hook_playora_before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_ip inet;
  v_ip_hash bytea;
  v_device_id text;
  v_device_hash bytea;
  v_pepper bytea;
  v_attempt_count integer;
begin
  begin
    v_user_id := nullif(event->'user'->>'id','')::uuid;
    v_ip := nullif(event->'metadata'->>'ip_address','')::inet;
  exception when others then
    return jsonb_build_object(
      'error',jsonb_build_object(
        'http_code',400,
        'message','Playora could not validate signup metadata.'
      )
    );
  end;

  if v_user_id is null or v_ip is null then
    return jsonb_build_object(
      'error',jsonb_build_object(
        'http_code',400,
        'message','Playora signup requires valid account and network metadata.'
      )
    );
  end if;

  -- Auth may retry the same before-create hook. Do not count one user twice.
  if exists(select 1 from private.signup_ip_attempts a where a.user_id=v_user_id) then
    return '{}'::jsonb;
  end if;

  v_device_id := nullif(btrim(event->'user'->'user_metadata'->>'playora_install_id'),'');
  if v_device_id is not null then
    if v_device_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      return jsonb_build_object(
        'error',jsonb_build_object(
          'http_code',400,
          'message','This Playora installation identifier is invalid. Reopen the app and try again.'
        )
      );
    end if;
    v_device_hash := extensions.digest(convert_to(lower(v_device_id),'UTF8'),'sha256');
    if exists(select 1 from private.signup_device_claims d where d.device_hash=v_device_hash) then
      return jsonb_build_object(
        'error',jsonb_build_object(
          'http_code',403,
          'message','This device is already linked to a Playora account. Sign in to that account instead.'
        )
      );
    end if;
  end if;

  select s.hmac_pepper into v_pepper
  from private.signup_guard_secrets s
  where s.singleton=true;
  if v_pepper is null then
    return jsonb_build_object(
      'error',jsonb_build_object(
        'http_code',503,
        'message','Playora signup protection is temporarily unavailable.'
      )
    );
  end if;

  v_ip_hash := extensions.hmac(convert_to(host(v_ip),'UTF8'),v_pepper,'sha256');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('playora-signup-ip:'||encode(v_ip_hash,'hex'),0)
  );

  delete from private.signup_ip_attempts
  where created_at<now()-interval '30 days';

  select count(*) into v_attempt_count
  from private.signup_ip_attempts
  where ip_hash=v_ip_hash and created_at>=now()-interval '24 hours';

  if v_attempt_count>=3 then
    return jsonb_build_object(
      'error',jsonb_build_object(
        'http_code',429,
        'message','Too many new Playora accounts were created from this network. Try again later.'
      )
    );
  end if;

  insert into private.signup_ip_attempts(user_id,ip_hash)
  values(v_user_id,v_ip_hash)
  on conflict(user_id) do nothing;

  return '{}'::jsonb;
end;
$$;

revoke all on function public.hook_playora_before_user_created(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.hook_playora_before_user_created(jsonb) to supabase_auth_admin;

-- OAuth providers do not let the browser set Supabase user_metadata before
-- the provider callback creates the user. Bind those installs immediately
-- after the first authenticated session via claim_playora_installation().
create or replace function private.claim_signup_device_on_auth_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device_id text;
  v_device_hash bytea;
  v_existing_user uuid;
begin
  v_device_id := nullif(btrim(new.raw_user_meta_data->>'playora_install_id'),'');
  if v_device_id is null then
    return new;
  end if;
  if v_device_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'invalid_playora_install_id' using errcode='22023';
  end if;

  v_device_hash := extensions.digest(convert_to(lower(v_device_id),'UTF8'),'sha256');
  insert into private.signup_device_claims(device_hash,user_id)
  values(v_device_hash,new.id)
  on conflict(device_hash) do nothing;

  select user_id into v_existing_user
  from private.signup_device_claims
  where device_hash=v_device_hash;

  if v_existing_user is distinct from new.id then
    raise exception 'playora_device_already_registered' using errcode='23505';
  end if;
  return new;
end;
$$;
revoke all on function private.claim_signup_device_on_auth_insert() from public,anon,authenticated,service_role;

drop trigger if exists auth_users_claim_playora_device on auth.users;
create trigger auth_users_claim_playora_device
after insert on auth.users
for each row execute function private.claim_signup_device_on_auth_insert();

create or replace function public.claim_playora_installation(p_install_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_device_hash bytea;
  v_claimed_user uuid;
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  if p_install_id is null
     or p_install_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    raise exception 'invalid_playora_install_id' using errcode='22023';
  end if;

  v_device_hash := extensions.digest(convert_to(lower(p_install_id),'UTF8'),'sha256');
  insert into private.signup_device_claims(device_hash,user_id)
  values(v_device_hash,v_user_id)
  on conflict(device_hash) do update
  set last_seen_at=now()
  where private.signup_device_claims.user_id=v_user_id
  returning user_id into v_claimed_user;

  if v_claimed_user is null then
    raise exception 'playora_device_already_registered' using errcode='23505';
  end if;
  return true;
end;
$$;

revoke all on function public.claim_playora_installation(text) from public,anon;
grant execute on function public.claim_playora_installation(text) to authenticated;

comment on table private.signup_device_claims is
  'Private one-account-per-install binding. Stores only a hash of the random installation UUID.';
comment on table private.signup_ip_attempts is
  'Thirty-day retention of HMACed IP signup events; enforces a maximum of three new accounts per IP per rolling 24 hours.';
comment on function public.hook_playora_before_user_created(jsonb) is
  'Configure as Supabase Auth Before User Created hook. Checks a unique app install ID where supplied and caps new accounts at three per IP per rolling day.';
comment on function public.claim_playora_installation(text) is
  'Authenticated, idempotent binding of the current app installation to the current member account.';

commit;

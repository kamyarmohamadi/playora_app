-- Playora secure data foundation for Supabase/Postgres.
-- All balance, match, room, payout and payment state changes are server-owned.
-- Apply only to a new/compatible Supabase project after reviewing the migration.

create extension if not exists pgcrypto;

create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name text not null default 'Player' check (char_length(display_name) between 1 and 32),
  avatar_key text,
  locale text not null default 'en' check (locale in ('en','fa')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'en' check (locale in ('en','fa')),
  sound_enabled boolean not null default true,
  reduced_motion boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.coin_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  free_coins bigint not null default 50 check (free_coins >= 0),
  purchased_coins bigint not null default 0 check (purchased_coins >= 0),
  reward_coins bigint not null default 0 check (reward_coins >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount <> 0),
  bucket text not null check (bucket in ('free','purchased','reward')),
  event_type text not null check (event_type in ('signup_bonus','purchase','match_entry','match_refund','tournament_reward','admin_adjustment','promotion','reversal')),
  reference_id text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists coin_ledger_user_created_idx on public.coin_ledger(user_id, created_at desc);

create table if not exists public.catalog_games (
  id text primary key check (id ~ '^[a-z0-9_-]{2,40}$'),
  title_en text not null,
  title_fa text not null,
  category text not null check (category in ('strategy','board','cards','puzzle')),
  is_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
insert into public.catalog_games(id,title_en,title_fa,category,is_enabled) values
  ('chess','Chess','شطرنج','strategy',false),
  ('pool','Pool','بیلیارد','strategy',false),
  ('ludo','Ludo','منچ','board',false),
  ('checkers','Checkers','چکرز','board',false),
  ('hokm','Hokm','حکم','cards',false),
  ('backgammon','Backgammon','تخته‌نرد','board',false),
  ('tictactoe','Tic Tac Toe','دوز','puzzle',false),
  ('rummy','Rummy','رامی','cards',false)
on conflict (id) do nothing;

-- Tic Tac Toe is the first implemented online mode; keep every other title disabled.
update public.catalog_games set is_enabled = true where id = 'tictactoe';

create table if not exists public.member_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null references public.catalog_games(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, game_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.catalog_games(id),
  mode text not null check (mode in ('practice','ranked','private','tournament')),
  status text not null default 'created' check (status in ('created','waiting','active','completed','cancelled','disputed')),
  state_version integer not null default 0 check (state_version >= 0),
  server_state jsonb not null default '{}'::jsonb,
  winner_user_id uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists matches_status_created_idx on public.matches(status,created_at desc);

create table if not exists public.match_participants (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat smallint not null check (seat between 1 and 8),
  final_result text check (final_result in ('win','loss','draw','forfeit')),
  joined_at timestamptz not null default now(),
  primary key(match_id,user_id),
  unique(match_id,seat)
);
create index if not exists match_participants_user_idx on public.match_participants(user_id,joined_at desc);


create table if not exists public.member_game_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null references public.catalog_games(id) on delete cascade,
  xp bigint not null default 0 check (xp >= 0),
  competitive_rating integer not null default 1000 check (competitive_rating between 100 and 10000),
  matches_played integer not null default 0 check (matches_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  updated_at timestamptz not null default now(),
  primary key(user_id,game_id),
  check (matches_played >= wins + losses + draws)
);
create index if not exists member_game_stats_leaderboard_idx
  on public.member_game_stats(game_id,competitive_rating desc,xp desc);

create table if not exists public.matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null references public.catalog_games(id),
  status text not null default 'waiting' check (status in ('waiting','matched','cancelled','expired')),
  rating_snapshot integer not null default 1000 check (rating_snapshot between 100 and 10000),
  match_id uuid references public.matches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'matched' and match_id is not null) or status <> 'matched')
);
create unique index if not exists matchmaking_one_waiting_per_member_game
  on public.matchmaking_queue(user_id,game_id) where status='waiting';
create index if not exists matchmaking_candidates_idx
  on public.matchmaking_queue(game_id,status,created_at) where status='waiting';
create index if not exists matchmaking_member_history_idx
  on public.matchmaking_queue(user_id,game_id,updated_at desc);

create table if not exists public.private_rooms (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null references public.catalog_games(id),
  status text not null default 'open' check (status in ('open','active','closed','expired')),
  max_players smallint not null default 2 check (max_players between 2 and 8),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);
create index if not exists private_rooms_host_idx on public.private_rooms(host_user_id,created_at desc);

-- Room invite hashes are never readable by client roles.
create table if not exists public.private_room_secrets (
  room_id uuid primary key references public.private_rooms(id) on delete cascade,
  invite_code_hash text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.private_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'player' check (role in ('host','player')),
  joined_at timestamptz not null default now(),
  primary key(room_id,user_id)
);
create index if not exists room_members_user_idx on public.room_members(user_id,joined_at desc);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','blocked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> recipient_id),
  unique(sender_id,recipient_id)
);
create index if not exists friend_requests_recipient_idx on public.friend_requests(recipient_id,status,created_at desc);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.catalog_games(id),
  title_en text not null,
  title_fa text not null,
  starts_at timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','open','in_progress','completed','cancelled')),
  entry_coins bigint not null default 0 check (entry_coins >= 0),
  reward_policy text not null default 'disabled' check (reward_policy in ('disabled','free_sponsor','approved')),
  created_at timestamptz not null default now()
);
create table if not exists public.tournament_entries (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'registered' check (status in ('registered','eliminated','winner','withdrawn')),
  final_place integer check (final_place > 0),
  created_at timestamptz not null default now(),
  primary key(tournament_id,user_id)
);
create index if not exists tournament_entries_user_idx on public.tournament_entries(user_id,created_at desc);

create table if not exists public.deposit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_code text not null check (asset_code ~ '^[A-Z0-9]{2,10}$'),
  network_code text not null check (network_code ~ '^[A-Z0-9_-]{2,24}$'),
  expected_amount numeric(30,12) not null check (expected_amount > 0),
  tx_hash text,
  status text not null default 'created' check (status in ('created','pending_confirmation','under_review','credited','rejected','expired')),
  confirmations integer not null default 0 check (confirmations >= 0),
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists deposit_requests_tx_hash_unique on public.deposit_requests(lower(tx_hash)) where tx_hash is not null;
create index if not exists deposit_requests_user_idx on public.deposit_requests(user_id,created_at desc);

create table if not exists public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  request_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists security_audit_events_user_idx on public.security_audit_events(user_id,created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.handle_new_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_locale text;
  safe_display_name text;
  generated_username text;
begin
  safe_locale := case when new.raw_user_meta_data ->> 'locale' in ('en','fa') then new.raw_user_meta_data ->> 'locale' else 'en' end;
  safe_display_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'),''),'Player'),32);
  generated_username := 'player_' || substr(md5(new.id::text),1,16);

  insert into public.member_profiles(user_id,username,display_name,locale)
  values(new.id,generated_username,safe_display_name,safe_locale)
  on conflict (user_id) do nothing;

  insert into public.member_preferences(user_id,locale)
  values(new.id,safe_locale)
  on conflict (user_id) do nothing;

  insert into public.coin_wallets(user_id,free_coins,purchased_coins,reward_coins)
  values(new.id,50,0,0)
  on conflict (user_id) do nothing;

  insert into public.coin_ledger(user_id,amount,bucket,event_type,idempotency_key)
  values(new.id,50,'free','signup_bonus','signup_bonus:' || new.id::text)
  on conflict (idempotency_key) do nothing;

  return new;
end;
$$;
revoke all on function public.handle_new_member() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_playora on auth.users;
create trigger on_auth_user_created_playora
after insert on auth.users
for each row execute function public.handle_new_member();

drop trigger if exists member_profiles_updated_at on public.member_profiles;
create trigger member_profiles_updated_at before update on public.member_profiles for each row execute function public.set_updated_at();
drop trigger if exists member_preferences_updated_at on public.member_preferences;
create trigger member_preferences_updated_at before update on public.member_preferences for each row execute function public.set_updated_at();
drop trigger if exists coin_wallets_updated_at on public.coin_wallets;
create trigger coin_wallets_updated_at before update on public.coin_wallets for each row execute function public.set_updated_at();
drop trigger if exists deposit_requests_updated_at on public.deposit_requests;
create trigger deposit_requests_updated_at before update on public.deposit_requests for each row execute function public.set_updated_at();

-- All wallet changes pass through this server-only, transactional, idempotent function.
-- The browser role has no EXECUTE privilege. Never call it with a service key from the client.
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
  if coalesce(auth.role(), 'anon') <> 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_user_id is null
     or p_bucket not in ('free','purchased','reward')
     or p_event_type not in ('signup_bonus','purchase','match_entry','match_refund','tournament_reward','admin_adjustment','promotion','reversal')
     or p_amount = 0
     or p_amount < -1000000000
     or p_amount > 1000000000
     or p_idempotency_key is null
     or pg_catalog.char_length(p_idempotency_key) < 8
     or pg_catalog.char_length(p_idempotency_key) > 200
     or (p_reference_id is not null and pg_catalog.char_length(p_reference_id) > 200)
  then
    raise exception 'invalid_wallet_operation' using errcode = '22023';
  end if;

  if (p_event_type in ('signup_bonus','purchase','match_refund','tournament_reward','promotion') and p_amount < 0)
     or (p_event_type = 'match_entry' and p_amount > 0)
     or (p_event_type = 'signup_bonus' and p_bucket <> 'free')
     or (p_event_type = 'purchase' and p_bucket <> 'purchased')
     or (p_event_type = 'tournament_reward' and p_bucket <> 'reward')
  then
    raise exception 'invalid_wallet_event_direction' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key, 0));

  select * into v_existing
  from public.coin_ledger
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.user_id <> p_user_id
       or v_existing.bucket <> p_bucket
       or v_existing.amount <> p_amount
       or v_existing.event_type <> p_event_type
       or v_existing.reference_id is distinct from p_reference_id
    then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;

    select * into v_wallet from public.coin_wallets where user_id = p_user_id;
    if not found then
      raise exception 'wallet_not_found' using errcode = 'P0002';
    end if;
    return v_wallet;
  end if;

  select * into v_wallet
  from public.coin_wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'wallet_not_found' using errcode = 'P0002';
  end if;

  update public.coin_wallets
  set free_coins = case when p_bucket = 'free' then free_coins + p_amount else free_coins end,
      purchased_coins = case when p_bucket = 'purchased' then purchased_coins + p_amount else purchased_coins end,
      reward_coins = case when p_bucket = 'reward' then reward_coins + p_amount else reward_coins end,
      updated_at = now()
  where user_id = p_user_id
    and (
      (p_bucket = 'free' and free_coins + p_amount >= 0)
      or (p_bucket = 'purchased' and purchased_coins + p_amount >= 0)
      or (p_bucket = 'reward' and reward_coins + p_amount >= 0)
    )
  returning * into v_wallet;

  if not found then
    raise exception 'insufficient_coin_balance' using errcode = '23514';
  end if;

  insert into public.coin_ledger(user_id, amount, bucket, event_type, reference_id, idempotency_key)
  values(p_user_id, p_amount, p_bucket, p_event_type, p_reference_id, p_idempotency_key);

  return v_wallet;
end;
$$;
revoke all on function public.apply_coin_delta(uuid, text, bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_coin_delta(uuid, text, bigint, text, text, text) to service_role;

-- Private helper for server-authoritative Tic Tac Toe result validation.
create or replace function public.find_tictactoe_winner(p_board jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_board is null or pg_catalog.jsonb_typeof(p_board) <> 'array'
     or pg_catalog.jsonb_array_length(p_board) <> 9 then
    return null;
  end if;

  if p_board->>0 = 'X' and p_board->>1 = 'X' and p_board->>2 = 'X' then return 'X'; end if;
  if p_board->>3 = 'X' and p_board->>4 = 'X' and p_board->>5 = 'X' then return 'X'; end if;
  if p_board->>6 = 'X' and p_board->>7 = 'X' and p_board->>8 = 'X' then return 'X'; end if;
  if p_board->>0 = 'X' and p_board->>3 = 'X' and p_board->>6 = 'X' then return 'X'; end if;
  if p_board->>1 = 'X' and p_board->>4 = 'X' and p_board->>7 = 'X' then return 'X'; end if;
  if p_board->>2 = 'X' and p_board->>5 = 'X' and p_board->>8 = 'X' then return 'X'; end if;
  if p_board->>0 = 'X' and p_board->>4 = 'X' and p_board->>8 = 'X' then return 'X'; end if;
  if p_board->>2 = 'X' and p_board->>4 = 'X' and p_board->>6 = 'X' then return 'X'; end if;

  if p_board->>0 = 'O' and p_board->>1 = 'O' and p_board->>2 = 'O' then return 'O'; end if;
  if p_board->>3 = 'O' and p_board->>4 = 'O' and p_board->>5 = 'O' then return 'O'; end if;
  if p_board->>6 = 'O' and p_board->>7 = 'O' and p_board->>8 = 'O' then return 'O'; end if;
  if p_board->>0 = 'O' and p_board->>3 = 'O' and p_board->>6 = 'O' then return 'O'; end if;
  if p_board->>1 = 'O' and p_board->>4 = 'O' and p_board->>7 = 'O' then return 'O'; end if;
  if p_board->>2 = 'O' and p_board->>5 = 'O' and p_board->>8 = 'O' then return 'O'; end if;
  if p_board->>0 = 'O' and p_board->>4 = 'O' and p_board->>8 = 'O' then return 'O'; end if;
  if p_board->>2 = 'O' and p_board->>4 = 'O' and p_board->>6 = 'O' then return 'O'; end if;
  return null;
end;
$$;
revoke all on function public.find_tictactoe_winner(jsonb) from public, anon, authenticated;

-- A member may only enqueue themselves; opponents are selected by the server,
-- rating band, and 24-hour rematch exclusion. No target user ID is accepted.
create or replace function public.queue_for_random_match(p_game_id text)
returns table(queue_status text, matched_match_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_rating integer;
  v_queue public.matchmaking_queue;
  v_opponent public.matchmaking_queue;
  v_match_id uuid;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_game_id is distinct from 'tictactoe' then
    raise exception 'game_not_supported_for_online_matchmaking' using errcode = '22023';
  end if;
  if not exists (select 1 from public.catalog_games g where g.id = p_game_id and g.is_enabled = true) then
    raise exception 'game_not_available' using errcode = '22023';
  end if;

  -- Serialize queue operations per game; the queue is small at launch and this
  -- makes duplicate concurrent joins unable to match a player twice.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('playora-queue:' || p_game_id, 0));

  insert into public.member_game_stats(user_id,game_id)
  values(v_user_id,p_game_id)
  on conflict (user_id,game_id) do nothing;

  select s.competitive_rating into v_rating
  from public.member_game_stats s
  where s.user_id = v_user_id and s.game_id = p_game_id;

  -- If the member already has an active match, return it instead of opening a second one.
  select q.match_id into v_match_id
  from public.matchmaking_queue q
  join public.matches m on m.id = q.match_id and m.status = 'active'
  where q.user_id = v_user_id and q.game_id = p_game_id and q.status = 'matched'
  order by q.updated_at desc
  limit 1;
  if found then
    return query select 'matched'::text, v_match_id;
    return;
  end if;

  select q.* into v_queue
  from public.matchmaking_queue q
  where q.user_id = v_user_id and q.game_id = p_game_id and q.status = 'waiting'
  order by q.created_at desc
  limit 1
  for update;

  if not found then
    insert into public.matchmaking_queue(user_id,game_id,status,rating_snapshot)
    values(v_user_id,p_game_id,'waiting',v_rating)
    on conflict (user_id,game_id) where status = 'waiting' do nothing
    returning * into v_queue;

    if not found then
      select q.* into v_queue
      from public.matchmaking_queue q
      where q.user_id = v_user_id and q.game_id = p_game_id and q.status = 'waiting'
      order by q.created_at desc limit 1 for update;
    end if;
  end if;

  select q.* into v_opponent
  from public.matchmaking_queue q
  where q.game_id = p_game_id
    and q.status = 'waiting'
    and q.user_id <> v_user_id
    and pg_catalog.abs(q.rating_snapshot - v_queue.rating_snapshot) <= 200
    and not exists (
      select 1
      from public.matches old_match
      join public.match_participants self_participant on self_participant.match_id = old_match.id and self_participant.user_id = v_user_id
      join public.match_participants opponent_participant on opponent_participant.match_id = old_match.id and opponent_participant.user_id = q.user_id
      where old_match.game_id = p_game_id
        and old_match.status = 'completed'
        and old_match.created_at >= now() - interval '24 hours'
    )
  order by random()
  limit 1
  for update skip locked;

  if not found then
    return query select 'waiting'::text, null::uuid;
    return;
  end if;

  insert into public.member_game_stats(user_id,game_id)
  values(v_opponent.user_id,p_game_id)
  on conflict (user_id,game_id) do nothing;

  insert into public.matches(game_id,mode,status,state_version,server_state,started_at)
  values (
    p_game_id,
    'ranked',
    'active',
    0,
    pg_catalog.jsonb_build_object(
      'board', pg_catalog.jsonb_build_array(null,null,null,null,null,null,null,null,null),
      'current_mark', 'X',
      'current_seat', 1
    ),
    now()
  )
  returning id into v_match_id;

  -- The previously queued member is seat 1 / X. The current member is seat 2 / O.
  insert into public.match_participants(match_id,user_id,seat)
  values (v_match_id,v_opponent.user_id,1),(v_match_id,v_user_id,2);

  update public.matchmaking_queue
  set status = 'matched', match_id = v_match_id, updated_at = now()
  where id in (v_queue.id,v_opponent.id);

  return query select 'matched'::text, v_match_id;
end;
$$;
revoke all on function public.queue_for_random_match(text) from public, anon;
grant execute on function public.queue_for_random_match(text) to authenticated;

create or replace function public.cancel_random_match_queue(p_game_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.matchmaking_queue
  set status = 'cancelled', updated_at = now()
  where user_id = v_user_id and game_id = p_game_id and status = 'waiting';
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;
revoke all on function public.cancel_random_match_queue(text) from public, anon;
grant execute on function public.cancel_random_match_queue(text) to authenticated;

-- Every move is checked against server state while holding the match row lock.
-- The client submits only a cell index; it cannot set marks, turns, winners, XP, or rating.
create or replace function public.submit_tictactoe_move(p_match_id uuid, p_cell_index integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_seat integer;
  v_match public.matches;
  v_board jsonb;
  v_new_state jsonb;
  v_mark text;
  v_winner_mark text;
  v_draw boolean;
  v_winner_user uuid;
  v_loser_user uuid;
  v_seat_one_user uuid;
  v_seat_two_user uuid;
  v_winner_rating integer;
  v_loser_rating integer;
  v_seat_one_rating integer;
  v_seat_two_rating integer;
  v_rating_delta integer;
  v_expected numeric;
  v_expected_seat_one numeric;
  v_next_seat integer;
  v_next_mark text;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_cell_index is null or p_cell_index < 0 or p_cell_index > 8 then
    raise exception 'invalid_cell' using errcode = '22023';
  end if;

  select m.* into v_match
  from public.matches m
  where m.id = p_match_id and m.game_id = 'tictactoe'
  for update;
  if not found
     or v_match.status <> 'active'
     or v_match.mode <> 'ranked'
     or not exists (
       select 1 from public.match_participants p
       where p.match_id = p_match_id and p.user_id = v_user_id
     )
  then
    raise exception 'match_not_available' using errcode = '42501';
  end if;

  select p.seat into v_user_seat
  from public.match_participants p
  where p.match_id = p_match_id and p.user_id = v_user_id;
  if v_user_seat is null then
    raise exception 'not_a_match_participant' using errcode = '42501';
  end if;
  if (v_match.server_state->>'current_seat')::integer <> v_user_seat then
    raise exception 'not_your_turn' using errcode = '42501';
  end if;

  v_board := v_match.server_state->'board';
  if pg_catalog.jsonb_typeof(v_board) <> 'array' or pg_catalog.jsonb_array_length(v_board) <> 9 then
    raise exception 'invalid_match_state' using errcode = '22023';
  end if;
  if (v_board -> p_cell_index) is distinct from 'null'::jsonb then
    raise exception 'cell_occupied' using errcode = '22023';
  end if;

  v_mark := v_match.server_state->>'current_mark';
  if v_mark not in ('X','O') then
    raise exception 'invalid_match_state' using errcode = '22023';
  end if;

  v_board := pg_catalog.jsonb_set(v_board, array[p_cell_index::text], pg_catalog.to_jsonb(v_mark), false);
  v_new_state := pg_catalog.jsonb_set(v_match.server_state, '{board}', v_board, false);
  v_winner_mark := public.find_tictactoe_winner(v_board);
  v_draw := v_winner_mark is null and not exists (
    select 1 from pg_catalog.jsonb_array_elements(v_board) as cells(value)
    where cells.value = 'null'::jsonb
  );

  if v_winner_mark is not null then
    select p.user_id into v_seat_one_user from public.match_participants p where p.match_id=p_match_id and p.seat=1;
    select p.user_id into v_seat_two_user from public.match_participants p where p.match_id=p_match_id and p.seat=2;
    v_winner_user := case when v_winner_mark = 'X' then v_seat_one_user else v_seat_two_user end;
    v_loser_user := case when v_winner_mark = 'X' then v_seat_two_user else v_seat_one_user end;

    insert into public.member_game_stats(user_id,game_id) values(v_winner_user,'tictactoe'),(v_loser_user,'tictactoe')
    on conflict (user_id,game_id) do nothing;
    select s.competitive_rating into v_winner_rating from public.member_game_stats s where s.user_id=v_winner_user and s.game_id='tictactoe' for update;
    select s.competitive_rating into v_loser_rating from public.member_game_stats s where s.user_id=v_loser_user and s.game_id='tictactoe' for update;

    v_expected := 1.0 / (1.0 + pg_catalog.power(10.0, (v_loser_rating::numeric - v_winner_rating::numeric) / 400.0));
    v_rating_delta := pg_catalog.round(32.0 * (1.0 - v_expected))::integer;

    update public.matches
    set status='completed', winner_user_id=v_winner_user, server_state=v_new_state,
        state_version=state_version+1, finished_at=now()
    where id=p_match_id returning * into v_match;
    update public.match_participants
    set final_result=case when user_id=v_winner_user then 'win' else 'loss' end
    where match_id=p_match_id;

    update public.member_game_stats
    set xp=xp + case when v_loser_rating > v_winner_rating then 25 when v_loser_rating = v_winner_rating then 20 else 15 end,
        competitive_rating=greatest(100,least(10000,competitive_rating+v_rating_delta)),
        matches_played=matches_played+1,wins=wins+1,updated_at=now()
    where user_id=v_winner_user and game_id='tictactoe';

    update public.member_game_stats
    set xp=xp + case when v_loser_rating > v_winner_rating then 5 when v_loser_rating = v_winner_rating then 6 else 8 end,
        competitive_rating=greatest(100,least(10000,competitive_rating-v_rating_delta)),
        matches_played=matches_played+1,losses=losses+1,updated_at=now()
    where user_id=v_loser_user and game_id='tictactoe';

    return pg_catalog.jsonb_build_object(
      'match_id',v_match.id,'status',v_match.status,'state',v_match.server_state,
      'state_version',v_match.state_version,'winner_mark',v_winner_mark
    );
  elsif v_draw then
    select p.user_id into v_seat_one_user from public.match_participants p where p.match_id=p_match_id and p.seat=1;
    select p.user_id into v_seat_two_user from public.match_participants p where p.match_id=p_match_id and p.seat=2;
    insert into public.member_game_stats(user_id,game_id) values(v_seat_one_user,'tictactoe'),(v_seat_two_user,'tictactoe')
    on conflict (user_id,game_id) do nothing;
    select s.competitive_rating into v_seat_one_rating from public.member_game_stats s where s.user_id=v_seat_one_user and s.game_id='tictactoe' for update;
    select s.competitive_rating into v_seat_two_rating from public.member_game_stats s where s.user_id=v_seat_two_user and s.game_id='tictactoe' for update;
    v_expected_seat_one := 1.0 / (1.0 + pg_catalog.power(10.0, (v_seat_two_rating::numeric - v_seat_one_rating::numeric) / 400.0));
    v_rating_delta := pg_catalog.round(32.0 * (0.5 - v_expected_seat_one))::integer;

    update public.matches
    set status='completed', winner_user_id=null, server_state=v_new_state,
        state_version=state_version+1, finished_at=now()
    where id=p_match_id returning * into v_match;
    update public.match_participants set final_result='draw' where match_id=p_match_id;
    update public.member_game_stats
    set xp=xp+10,competitive_rating=greatest(100,least(10000,competitive_rating+v_rating_delta)),
        matches_played=matches_played+1,draws=draws+1,updated_at=now()
    where user_id=v_seat_one_user and game_id='tictactoe';
    update public.member_game_stats
    set xp=xp+10,competitive_rating=greatest(100,least(10000,competitive_rating-v_rating_delta)),
        matches_played=matches_played+1,draws=draws+1,updated_at=now()
    where user_id=v_seat_two_user and game_id='tictactoe';

    return pg_catalog.jsonb_build_object(
      'match_id',v_match.id,'status',v_match.status,'state',v_match.server_state,
      'state_version',v_match.state_version,'winner_mark',null
    );
  end if;

  v_next_seat := case when v_user_seat = 1 then 2 else 1 end;
  v_next_mark := case when v_mark = 'X' then 'O' else 'X' end;
  v_new_state := pg_catalog.jsonb_set(v_new_state, '{current_mark}', pg_catalog.to_jsonb(v_next_mark), false);
  v_new_state := pg_catalog.jsonb_set(v_new_state, '{current_seat}', pg_catalog.to_jsonb(v_next_seat), false);

  update public.matches
  set server_state=v_new_state,state_version=state_version+1
  where id=p_match_id and status='active'
  returning * into v_match;

  return pg_catalog.jsonb_build_object(
    'match_id',v_match.id,'status',v_match.status,'state',v_match.server_state,
    'state_version',v_match.state_version,'winner_mark',null
  );
end;
$$;
revoke all on function public.submit_tictactoe_move(uuid,integer) from public, anon;
grant execute on function public.submit_tictactoe_move(uuid,integer) to authenticated;

alter table public.member_profiles enable row level security;
alter table public.member_preferences enable row level security;
alter table public.coin_wallets enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.catalog_games enable row level security;
alter table public.member_favorites enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
alter table public.member_game_stats enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.private_rooms enable row level security;
alter table public.private_room_secrets enable row level security;
alter table public.room_members enable row level security;
alter table public.friend_requests enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.deposit_requests enable row level security;
alter table public.security_audit_events enable row level security;

-- Make the default posture explicit even if project-level default privileges change.
revoke all on table
  public.member_profiles, public.member_preferences, public.coin_wallets, public.coin_ledger,
  public.catalog_games, public.member_favorites, public.matches, public.match_participants, public.member_game_stats, public.matchmaking_queue,
  public.private_rooms, public.private_room_secrets, public.room_members, public.friend_requests,
  public.tournaments, public.tournament_entries, public.deposit_requests, public.security_audit_events
from anon, authenticated;

-- Explicit grants: table ownership and privileged service access stay server-side.
grant usage on schema public to authenticated;
grant select on public.member_profiles to authenticated;
grant update(display_name,avatar_key,locale) on public.member_profiles to authenticated;
grant select on public.member_preferences to authenticated;
grant insert(user_id,locale,sound_enabled,reduced_motion) on public.member_preferences to authenticated;
grant update(locale,sound_enabled,reduced_motion) on public.member_preferences to authenticated;
grant select on public.coin_wallets to authenticated;
grant select on public.coin_ledger to authenticated;
grant select on public.catalog_games to authenticated;
grant select,insert,delete on public.member_favorites to authenticated;
grant select on public.matches to authenticated;
grant select on public.match_participants to authenticated;
grant select on public.member_game_stats to authenticated;
grant select on public.matchmaking_queue to authenticated;
grant select on public.private_rooms to authenticated;
grant select on public.room_members to authenticated;
grant select on public.friend_requests to authenticated;
grant select on public.tournaments to authenticated;
grant select on public.tournament_entries to authenticated;
grant select on public.deposit_requests to authenticated;
grant select on public.security_audit_events to authenticated;

create policy "members read own profile" on public.member_profiles for select to authenticated using (user_id = (select auth.uid()));
create policy "members update own profile" on public.member_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "members read own preferences" on public.member_preferences for select to authenticated using (user_id = (select auth.uid()));
create policy "members insert own preferences" on public.member_preferences for insert to authenticated with check (user_id = (select auth.uid()));
create policy "members update own preferences" on public.member_preferences for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "members read own wallet" on public.coin_wallets for select to authenticated using (user_id = (select auth.uid()));
create policy "members read own ledger" on public.coin_ledger for select to authenticated using (user_id = (select auth.uid()));

create policy "authenticated read enabled games" on public.catalog_games for select to authenticated using (is_enabled = true);
create policy "members read own favorites" on public.member_favorites for select to authenticated using (user_id = (select auth.uid()));
create policy "members add own favorites" on public.member_favorites for insert to authenticated with check (user_id = (select auth.uid()));
create policy "members remove own favorites" on public.member_favorites for delete to authenticated using (user_id = (select auth.uid()));

create policy "members see matches they joined" on public.matches for select to authenticated using (
  exists (select 1 from public.match_participants p where p.match_id = id and p.user_id = (select auth.uid()))
);
create policy "members see their own participant rows" on public.match_participants for select to authenticated using (user_id = (select auth.uid()));
create policy "members see own game stats" on public.member_game_stats for select to authenticated using (user_id = (select auth.uid()));
create policy "members see own matchmaking rows" on public.matchmaking_queue for select to authenticated using (user_id = (select auth.uid()));

create policy "members see rooms they host or joined" on public.private_rooms for select to authenticated using (
  host_user_id = (select auth.uid()) or exists (
    select 1 from public.room_members rm where rm.room_id = id and rm.user_id = (select auth.uid())
  )
);
create policy "members see their room memberships" on public.room_members for select to authenticated using (user_id = (select auth.uid()));

create policy "members see friend requests involving them" on public.friend_requests for select to authenticated using (
  sender_id = (select auth.uid()) or recipient_id = (select auth.uid())
);
create policy "authenticated read listed tournaments" on public.tournaments for select to authenticated using (status in ('scheduled','open','in_progress','completed'));
create policy "members see own tournament entries" on public.tournament_entries for select to authenticated using (user_id = (select auth.uid()));
create policy "members see own deposit requests" on public.deposit_requests for select to authenticated using (user_id = (select auth.uid()));
create policy "members see own security audit events" on public.security_audit_events for select to authenticated using (user_id = (select auth.uid()));

-- Intentionally no client INSERT/UPDATE/DELETE policies for wallets, ledger,
-- matches, participants, rooms, memberships, friend requests, tournament entries,
-- payment requests, or audit events. Trusted server functions must own those writes.

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
  generated_username := 'player_' || substr(replace(new.id::text,'-',''),1,16);

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

alter table public.member_profiles enable row level security;
alter table public.member_preferences enable row level security;
alter table public.coin_wallets enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.catalog_games enable row level security;
alter table public.member_favorites enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
alter table public.private_rooms enable row level security;
alter table public.private_room_secrets enable row level security;
alter table public.room_members enable row level security;
alter table public.friend_requests enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.deposit_requests enable row level security;
alter table public.security_audit_events enable row level security;

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

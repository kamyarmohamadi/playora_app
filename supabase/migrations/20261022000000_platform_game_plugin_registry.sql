-- Public catalog metadata is separate from the private/trusted registry of launchable game artifacts.
-- No row is launchable just because it is visible in the catalog. Both catalog_games.is_enabled
-- and an enabled immutable version in game_plugin_versions must permit a launch later.
begin;

alter table public.catalog_games
  add column if not exists catalog_visible boolean not null default false,
  add column if not exists subtitle_en text not null default 'Discover a new challenge',
  add column if not exists subtitle_fa text not null default 'یک چالش تازه را کشف کن',
  add column if not exists players_en text not null default '2 players',
  add column if not exists players_fa text not null default '۲ بازیکن',
  add column if not exists icon_key text not null default 'grid'
    check (icon_key in ('activity','crown','dices','grid','puzzle','spade')),
  add column if not exists color text not null default 'cyan'
    check (color in ('cyan','violet','pink','blue','gold')),
  add column if not exists featured boolean not null default false;

update public.catalog_games
set catalog_visible = true,
    subtitle_en = case id
      when 'chess' then 'Think three moves ahead'
      when 'pool' then 'Precision meets pressure'
      when 'ludo' then 'A classic, reimagined'
      when 'checkers' then 'Own the board'
      when 'hokm' then 'Read the table'
      when 'backgammon' then 'Classic strategy, fast turns'
      when 'tictactoe' then 'Quick. Clever. Unpredictable.'
      when 'rummy' then 'Build your winning hand'
      else subtitle_en end,
    subtitle_fa = case id
      when 'chess' then 'چند حرکت جلوتر فکر کن'
      when 'pool' then 'دقت در اوج هیجان'
      when 'ludo' then 'یک بازی کلاسیک با حال‌وهوای تازه'
      when 'checkers' then 'صفحه را در اختیار بگیر'
      when 'hokm' then 'میز را هوشمندانه بخوان'
      when 'backgammon' then 'استراتژی کلاسیک و حرکت‌های سریع'
      when 'tictactoe' then 'سریع، هوشمندانه و غیرقابل‌پیش‌بینی'
      when 'rummy' then 'دست برنده‌ات را بساز'
      else subtitle_fa end,
    players_en = case id
      when 'ludo' then '2–4 players'
      when 'hokm' then '4 players'
      when 'rummy' then '2–4 players'
      else '2 players' end,
    players_fa = case id
      when 'ludo' then '۲ تا ۴ بازیکن'
      when 'hokm' then '۴ بازیکن'
      when 'rummy' then '۲ تا ۴ بازیکن'
      else '۲ بازیکن' end,
    icon_key = case id
      when 'chess' then 'crown'
      when 'pool' then 'activity'
      when 'ludo' then 'dices'
      when 'checkers' then 'grid'
      when 'hokm' then 'spade'
      when 'backgammon' then 'grid'
      when 'tictactoe' then 'puzzle'
      when 'rummy' then 'spade'
      else 'grid' end,
    color = case id
      when 'chess' then 'cyan'
      when 'pool' then 'violet'
      when 'ludo' then 'pink'
      when 'checkers' then 'blue'
      when 'hokm' then 'gold'
      when 'backgammon' then 'cyan'
      when 'tictactoe' then 'violet'
      when 'rummy' then 'pink'
      else 'cyan' end,
    featured = id in ('chess','pool','ludo');

drop policy if exists "authenticated read enabled games" on public.catalog_games;
create policy "public reads visible catalog metadata"
  on public.catalog_games for select to anon, authenticated
  using (catalog_visible = true);

grant usage on schema public to anon, authenticated;
revoke all on table public.catalog_games from public, anon, authenticated;
grant select on table public.catalog_games to anon, authenticated;

create table if not exists public.game_plugin_versions (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.catalog_games(id) on delete cascade,
  version text not null
    check (version ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
  manifest jsonb not null
    check (jsonb_typeof(manifest) = 'object'
       and manifest ->> 'id' = game_id
       and manifest ->> 'version' = version
       and manifest ->> 'manifestVersion' = '1'),
  sdk_min_version text not null
    check (sdk_min_version ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
  sdk_max_exclusive text not null
    check (sdk_max_exclusive ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
  entrypoint_url text not null check (entrypoint_url ~ '^https://[^[:space:]]+$'),
  artifact_sha256 text not null check (artifact_sha256 ~ '^[A-Fa-f0-9]{64}$'),
  requested_capabilities text[] not null default array[]::text[]
    check (cardinality(requested_capabilities) <= 16),
  state text not null default 'draft'
    check (state in ('draft','review','approved','enabled','disabled','revoked')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  enabled_at timestamptz,
  unique (game_id, version),
  check (sdk_min_version <> sdk_max_exclusive)
);

create index if not exists game_plugin_versions_game_state_idx
  on public.game_plugin_versions(game_id, state, created_at desc);
create unique index if not exists game_plugin_versions_one_enabled_per_game_idx
  on public.game_plugin_versions(game_id) where state = 'enabled';

create or replace function public.prevent_game_plugin_artifact_mutation()
returns trigger
language plpgsql
set search_path = ''
as $plugin_immutability$
begin
  if row(
    new.game_id, new.version, new.manifest, new.sdk_min_version,
    new.sdk_max_exclusive, new.entrypoint_url, new.artifact_sha256,
    new.requested_capabilities
  ) is distinct from row(
    old.game_id, old.version, old.manifest, old.sdk_min_version,
    old.sdk_max_exclusive, old.entrypoint_url, old.artifact_sha256,
    old.requested_capabilities
  ) then
    raise exception 'plugin_artifact_immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$plugin_immutability$;

revoke all on function public.prevent_game_plugin_artifact_mutation() from public, anon, authenticated, service_role;
drop trigger if exists game_plugin_versions_immutable_artifact on public.game_plugin_versions;
create trigger game_plugin_versions_immutable_artifact
  before update on public.game_plugin_versions
  for each row execute function public.prevent_game_plugin_artifact_mutation();

alter table public.game_plugin_versions enable row level security;
revoke all on table public.game_plugin_versions from public, anon, authenticated, service_role;
grant select (
  game_id, version, manifest, sdk_min_version, sdk_max_exclusive,
  entrypoint_url, artifact_sha256, requested_capabilities, state, created_at
) on public.game_plugin_versions to anon, authenticated;
grant select, insert, update, delete on public.game_plugin_versions to service_role;

create policy "public reads enabled approved game artifacts"
  on public.game_plugin_versions for select to anon, authenticated
  using (
    state = 'enabled'
    and exists (
      select 1 from public.catalog_games g
      where g.id = game_id and g.catalog_visible = true and g.is_enabled = true
    )
  );

create policy "service role manages game plugin registry"
  on public.game_plugin_versions for all to service_role
  using (true) with check (true);

commit;

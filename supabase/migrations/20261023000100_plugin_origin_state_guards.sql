-- Registry publication safety: explicit artifact-origin approval, strict manifest validation,
-- immutable artifact identity, and review-first state transitions.
begin;

create table public.game_plugin_artifact_origins (
  origin text primary key,
  is_approved boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  constraint game_plugin_artifact_origins_https check (
    origin = lower(origin)
    and origin ~ '^https://[a-z0-9][a-z0-9.-]*(:[1-9][0-9]{0,4})?$'
    and position('..' in origin) = 0
    and position('/' in substring(origin from 9)) = 0
  ),
  constraint game_plugin_artifact_origins_approval_audit check (
    not is_approved or (approved_by is not null and approved_at is not null)
  )
);

create index game_plugin_artifact_origins_approved_by_idx
  on public.game_plugin_artifact_origins(approved_by);

alter table public.game_plugin_versions
  add column updated_at timestamptz not null default now(),
  add column revoked_at timestamptz;

alter table public.game_plugin_versions
  add constraint game_plugin_versions_manifest_size
    check (pg_column_size(manifest) <= 16384),
  add constraint game_plugin_versions_manifest_root_shape
    check (
      manifest ?& array[
        'manifestVersion','id','version','title','description','category',
        'playerRange','sdkCompatibility','artifact','capabilities'
      ]::text[]
      and manifest - array[
        'manifestVersion','id','version','title','description','category',
        'playerRange','sdkCompatibility','artifact','capabilities'
      ]::text[] = '{}'::jsonb
    ),
  add constraint game_plugin_versions_manifest_locales
    check (
      jsonb_typeof(manifest->'title') = 'object'
      and (manifest->'title') ?& array['en','fa']::text[]
      and (manifest->'title') - array['en','fa']::text[] = '{}'::jsonb
      and jsonb_typeof(manifest->'title'->'en') = 'string'
      and jsonb_typeof(manifest->'title'->'fa') = 'string'
      and char_length(btrim(manifest->'title'->>'en')) between 1 and 80
      and char_length(btrim(manifest->'title'->>'fa')) between 1 and 80
      and jsonb_typeof(manifest->'description') = 'object'
      and (manifest->'description') ?& array['en','fa']::text[]
      and (manifest->'description') - array['en','fa']::text[] = '{}'::jsonb
      and jsonb_typeof(manifest->'description'->'en') = 'string'
      and jsonb_typeof(manifest->'description'->'fa') = 'string'
      and char_length(btrim(manifest->'description'->>'en')) between 1 and 240
      and char_length(btrim(manifest->'description'->>'fa')) between 1 and 240
    ),
  add constraint game_plugin_versions_manifest_category
    check (manifest->>'category' in ('strategy','board','cards','puzzle')),
  add constraint game_plugin_versions_manifest_player_range
    check (
      jsonb_typeof(manifest->'playerRange') = 'object'
      and (manifest->'playerRange') ?& array['min','max']::text[]
      and (manifest->'playerRange') - array['min','max']::text[] = '{}'::jsonb
      and jsonb_typeof(manifest->'playerRange'->'min') = 'number'
      and jsonb_typeof(manifest->'playerRange'->'max') = 'number'
      and (manifest->'playerRange'->>'min')::numeric between 1 and 8
      and (manifest->'playerRange'->>'max')::numeric between 1 and 8
      and trunc((manifest->'playerRange'->>'min')::numeric) = (manifest->'playerRange'->>'min')::numeric
      and trunc((manifest->'playerRange'->>'max')::numeric) = (manifest->'playerRange'->>'max')::numeric
      and (manifest->'playerRange'->>'min')::numeric <= (manifest->'playerRange'->>'max')::numeric
    ),
  add constraint game_plugin_versions_manifest_sdk_fields
    check (
      jsonb_typeof(manifest->'sdkCompatibility') = 'object'
      and (manifest->'sdkCompatibility') ?& array['min','maxExclusive']::text[]
      and (manifest->'sdkCompatibility') - array['min','maxExclusive']::text[] = '{}'::jsonb
      and manifest->'sdkCompatibility'->>'min' = sdk_min_version
      and manifest->'sdkCompatibility'->>'maxExclusive' = sdk_max_exclusive
    ),
  add constraint game_plugin_versions_entrypoint_shape
    check (
      entrypoint_url ~ '^https://[a-z0-9][a-z0-9.-]*(:[1-9][0-9]{0,4})?(/[A-Za-z0-9._~-]+)+$'
    ),
  add constraint game_plugin_versions_manifest_artifact
    check (
      jsonb_typeof(manifest->'artifact') = 'object'
      and (manifest->'artifact') ?& array['entrypointUrl','sha256']::text[]
      and (manifest->'artifact') - array['entrypointUrl','sha256']::text[] = '{}'::jsonb
      and manifest->'artifact'->>'entrypointUrl' = entrypoint_url
      and lower(manifest->'artifact'->>'sha256') = lower(artifact_sha256)
    ),
  add constraint game_plugin_versions_capability_allowlist
    check (
      requested_capabilities <@ array[
        'locale:read','profile:read','session:lifecycle',
        'match:request','private-room:request','telemetry:submit'
      ]::text[]
      and manifest->'capabilities' = to_jsonb(requested_capabilities)
      and jsonb_typeof(manifest->'capabilities') = 'array'
      and jsonb_array_length(manifest->'capabilities') <= 6
    );

create or replace function public.guard_game_plugin_origin_approval()
returns trigger
language plpgsql
set search_path = ''
as $origin_approval_guard$
begin
  if tg_op = 'INSERT' then
    if new.is_approved then
      raise exception 'artifact_origin_must_be_created_unapproved'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if new.origin is distinct from old.origin then
    raise exception 'artifact_origin_is_immutable'
      using errcode = '23514';
  end if;

  if old.is_approved = false and new.is_approved = true
     and (new.approved_by is null or new.approved_at is null) then
    raise exception 'artifact_origin_approval_requires_auditor'
      using errcode = '23514';
  end if;
  return new;
end;
$origin_approval_guard$;

create or replace function public.validate_game_plugin_origin()
returns trigger
language plpgsql
set search_path = ''
as $plugin_origin_guard$
declare
  v_origin text;
  v_unique_capabilities integer;
begin
  if tg_op = 'INSERT' or new.entrypoint_url is distinct from old.entrypoint_url then
    if new.entrypoint_url !~ '^https://[a-z0-9][a-z0-9.-]*(:[1-9][0-9]{0,4})?(/[A-Za-z0-9._~-]+)+$' then
      raise exception 'plugin_entrypoint_url_invalid'
        using errcode = '23514';
    end if;

    v_origin := substring(new.entrypoint_url from '^https://[^/]+');
    if not exists (
      select 1
      from public.game_plugin_artifact_origins o
      where o.origin = v_origin and o.is_approved = true
    ) then
      raise exception 'plugin_artifact_origin_not_approved'
        using errcode = '23514';
    end if;

    select count(distinct capability) into v_unique_capabilities
    from unnest(new.requested_capabilities) as capability;
    if v_unique_capabilities <> cardinality(new.requested_capabilities) then
      raise exception 'plugin_capabilities_must_be_unique'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$plugin_origin_guard$;

create or replace function public.guard_game_plugin_state_transition()
returns trigger
language plpgsql
set search_path = ''
as $plugin_state_guard$
declare
  v_transition_allowed boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.state <> 'draft'
       or new.reviewed_by is not null
       or new.reviewed_at is not null
       or new.enabled_at is not null
       or new.revoked_at is not null then
      raise exception 'plugin_must_start_in_draft'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'plugin_creation_audit_is_immutable'
      using errcode = '23514';
  end if;

  if new.state is not distinct from old.state then
    if new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.enabled_at is distinct from old.enabled_at
       or new.revoked_at is distinct from old.revoked_at then
      raise exception 'plugin_state_audit_requires_state_transition'
        using errcode = '23514';
    end if;
    return new;
  end if;

  v_transition_allowed :=
    (old.state = 'draft' and new.state in ('review','revoked'))
    or (old.state = 'review' and new.state in ('draft','approved','revoked'))
    or (old.state = 'approved' and new.state in ('enabled','disabled','revoked'))
    or (old.state = 'enabled' and new.state in ('disabled','revoked'))
    or (old.state = 'disabled' and new.state in ('approved','revoked'));

  if not v_transition_allowed then
    raise exception 'plugin_state_transition_not_allowed'
      using errcode = '23514';
  end if;

  if new.state = 'approved' then
    if new.reviewed_by is null or new.reviewed_at is null then
      raise exception 'plugin_approval_requires_reviewer_and_timestamp'
        using errcode = '23514';
    end if;
    new.enabled_at := null;
    new.revoked_at := null;
  elsif new.state = 'enabled' then
    if old.state <> 'approved'
       or new.reviewed_by is null
       or new.reviewed_at is null
       or new.enabled_at is null then
      raise exception 'plugin_enable_requires_approved_review'
        using errcode = '23514';
    end if;
    new.revoked_at := null;
  elsif new.state = 'revoked' then
    new.revoked_at := coalesce(new.revoked_at, now());
  elsif new.state = 'draft' or new.state = 'review' then
    new.enabled_at := null;
    new.revoked_at := null;
  end if;

  return new;
end;
$plugin_state_guard$;

create or replace function public.revoke_plugins_for_unapproved_origin()
returns trigger
language plpgsql
set search_path = ''
as $plugin_origin_revoke$
begin
  if old.is_approved = true and new.is_approved = false then
    update public.game_plugin_versions
      set state = 'revoked'
      where substring(entrypoint_url from '^https://[^/]+') = old.origin
        and state <> 'revoked';
  end if;
  return new;
end;
$plugin_origin_revoke$;

revoke all on function public.guard_game_plugin_origin_approval() from public, anon, authenticated, service_role;
revoke all on function public.validate_game_plugin_origin() from public, anon, authenticated, service_role;
revoke all on function public.guard_game_plugin_state_transition() from public, anon, authenticated, service_role;
revoke all on function public.revoke_plugins_for_unapproved_origin() from public, anon, authenticated, service_role;

create trigger game_plugin_artifact_origins_guard_approval
  before insert or update on public.game_plugin_artifact_origins
  for each row execute function public.guard_game_plugin_origin_approval();
create trigger game_plugin_versions_origin_guard
  before insert or update on public.game_plugin_versions
  for each row execute function public.validate_game_plugin_origin();
create trigger game_plugin_versions_state_guard
  before insert or update on public.game_plugin_versions
  for each row execute function public.guard_game_plugin_state_transition();
create trigger game_plugin_versions_updated_at
  before update on public.game_plugin_versions
  for each row execute function public.set_updated_at();
create trigger game_plugin_artifact_origins_revoke_plugins
  after update on public.game_plugin_artifact_origins
  for each row execute function public.revoke_plugins_for_unapproved_origin();

alter table public.game_plugin_artifact_origins enable row level security;
revoke all on table public.game_plugin_artifact_origins from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.game_plugin_artifact_origins to service_role;
create policy "service role manages approved artifact origins"
  on public.game_plugin_artifact_origins for all to service_role
  using (true) with check (true);

commit;

-- Store explicit trusted grants separately from manifest requests.
-- Browser roles can read grants for enabled rows but cannot write them.
begin;

alter table public.game_plugin_versions
  add column granted_capabilities text[] not null default array[]::text[],
  add constraint game_plugin_versions_grants_allowlist
    check (
      granted_capabilities <@ array[
        'locale:read','profile:read','session:lifecycle',
        'match:request','private-room:request','telemetry:submit'
      ]::text[]
      and granted_capabilities <@ requested_capabilities
      and cardinality(granted_capabilities) <= 6
    );

create or replace function public.guard_game_plugin_capability_grants()
returns trigger
language plpgsql
set search_path = ''
as $plugin_capability_grants_guard$
declare
  v_unique_count integer;
begin
  if new.granted_capabilities is null then
    raise exception 'plugin_grants_required' using errcode = '23514';
  end if;

  select count(distinct grant_item.capability)::integer
    into v_unique_count
    from unnest(new.granted_capabilities) as grant_item(capability);
  if v_unique_count <> cardinality(new.granted_capabilities) then
    raise exception 'duplicate_plugin_capability_grant' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
     and old.state in ('approved','enabled','disabled','revoked')
     and new.granted_capabilities is distinct from old.granted_capabilities then
    raise exception 'plugin_capability_grants_are_immutable_after_approval'
      using errcode = '23514';
  end if;
  return new;
end;
$plugin_capability_grants_guard$;

revoke all on function public.guard_game_plugin_capability_grants() from public, anon, authenticated, service_role;

create trigger game_plugin_versions_capability_grants_guard
  before insert or update on public.game_plugin_versions
  for each row execute function public.guard_game_plugin_capability_grants();

grant select (granted_capabilities) on public.game_plugin_versions to anon, authenticated;

commit;

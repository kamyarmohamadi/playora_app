-- Performance and correctness hardening for the trusted plugin registry.
-- Enforce semantic ordering for the SDK range and index internal actor references.
begin;

create index if not exists game_plugin_versions_created_by_idx
  on public.game_plugin_versions(created_by) where created_by is not null;
create index if not exists game_plugin_versions_reviewed_by_idx
  on public.game_plugin_versions(reviewed_by) where reviewed_by is not null;

do $sdk_range_constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'game_plugin_versions_sdk_range_ordered'
      and conrelid = 'public.game_plugin_versions'::regclass
  ) then
    alter table public.game_plugin_versions
      add constraint game_plugin_versions_sdk_range_ordered
      check (
        row(
          split_part(sdk_min_version, '.', 1)::numeric,
          split_part(sdk_min_version, '.', 2)::numeric,
          split_part(sdk_min_version, '.', 3)::numeric
        ) < row(
          split_part(sdk_max_exclusive, '.', 1)::numeric,
          split_part(sdk_max_exclusive, '.', 2)::numeric,
          split_part(sdk_max_exclusive, '.', 3)::numeric
        )
      );
  end if;
end
$sdk_range_constraint$;

commit;

-- Index the nullable creator reference on the trusted artifact-origin allowlist.
-- This avoids a sequential scan when creator accounts are deleted or changed.
begin;

create index if not exists game_plugin_artifact_origins_created_by_idx
  on public.game_plugin_artifact_origins(created_by)
  where created_by is not null;

commit;

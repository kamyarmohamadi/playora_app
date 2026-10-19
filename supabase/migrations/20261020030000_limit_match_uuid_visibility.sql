-- Privacy hardening: stop exposing opponent auth UUIDs through matches.
-- Safe to apply after the initial member, private-room, and social migrations.
-- Also corrects an already-created development database, not just fresh installs.

revoke select on table public.matches from anon, authenticated;

grant select (id, game_id, mode, status, state_version, server_state, started_at, finished_at, created_at)
  on table public.matches to authenticated;

-- Keep all authoritative writes server-owned. Column visibility never implies
-- permission to modify match state; mutations still go through verified RPCs.
revoke insert, update, delete on table public.matches from anon, authenticated;


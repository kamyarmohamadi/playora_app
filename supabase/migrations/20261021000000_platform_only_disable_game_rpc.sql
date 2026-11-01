-- Platform-only gate: game RPCs must not be callable by browser roles until a reviewed
-- game package and runtime pass the platform release gate. Legacy functions remain in
-- the database for later game packaging, but client EXECUTE is explicitly revoked.
begin;

revoke all on function public.cancel_random_match_queue(text) from public, anon, authenticated;
revoke all on function public.create_private_room(text, integer) from public, anon, authenticated;
revoke all on function public.get_game_leaderboard(text, integer) from public, anon, authenticated;
revoke all on function public.join_private_room(text) from public, anon, authenticated;
revoke all on function public.leave_private_room(uuid) from public, anon, authenticated;
revoke all on function public.queue_for_random_match(text) from public, anon, authenticated;
revoke all on function public.submit_private_tictactoe_move(uuid, integer) from public, anon, authenticated;
revoke all on function public.submit_tictactoe_move(uuid, integer) from public, anon, authenticated;

-- These tables are intentionally internal. Explicit false policies make their no-client
-- access contract visible to the linter and future maintainers; client roles also lack grants.
create policy "deny direct client access to private room secrets"
  on public.private_room_secrets for all to anon, authenticated
  using (false) with check (false);

create policy "deny direct client access to social anti-spam events"
  on public.social_action_events for all to anon, authenticated
  using (false) with check (false);

-- Cover foreign-key lookups used by relational deletes, joins, and future registry filtering.
create index if not exists matches_game_id_idx on public.matches(game_id);
create index if not exists matches_winner_user_id_idx on public.matches(winner_user_id);
create index if not exists matchmaking_queue_match_id_idx on public.matchmaking_queue(match_id);
create index if not exists member_favorites_game_id_idx on public.member_favorites(game_id);
create index if not exists private_rooms_game_id_idx on public.private_rooms(game_id);
create index if not exists tournaments_game_id_idx on public.tournaments(game_id);

commit;

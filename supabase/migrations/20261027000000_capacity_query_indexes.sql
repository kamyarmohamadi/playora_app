-- Query indexes for high-frequency member/social/room paths.
-- Indexes are based on current query predicates; confirm with EXPLAIN ANALYZE
-- against realistic staging data before adding further indexes.

create index if not exists friend_requests_sender_status_created_idx
  on public.friend_requests(sender_id, status, created_at desc);

create index if not exists private_rooms_host_open_expiry_idx
  on public.private_rooms(host_user_id, expires_at)
  where status = 'open';

create index if not exists private_rooms_open_expiry_idx
  on public.private_rooms(expires_at)
  where status = 'open';

\set ON_ERROR_STOP on

-- The trusted account-deletion function cleans up work but does not itself
-- delete auth.users; the Edge Function performs that final admin operation.
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-000000000021','delete-target@example.test','{"display_name":"Delete Target","locale":"en"}'),
  ('00000000-0000-4000-8000-000000000022','other-member@example.test','{"display_name":"Other Member","locale":"fa"}')
ON CONFLICT (id) DO NOTHING;

UPDATE public.catalog_games SET is_enabled=true WHERE id='tictactoe';
INSERT INTO public.member_game_stats(user_id,game_id)
VALUES
  ('00000000-0000-4000-8000-000000000021','tictactoe'),
  ('00000000-0000-4000-8000-000000000022','tictactoe')
ON CONFLICT (user_id,game_id) DO NOTHING;

-- Create one ranked match and one private match involving the deleting member.
INSERT INTO public.matches(id,game_id,mode,status,server_state,started_at)
VALUES
  ('10000000-0000-4000-8000-000000000021','tictactoe','ranked','active',
   '{"board":[null,null,null,null,null,null,null,null,null],"current_mark":"X","current_seat":1}'::jsonb,now()),
  ('10000000-0000-4000-8000-000000000022','tictactoe','private','active',
   '{"board":[null,null,null,null,null,null,null,null,null],"current_mark":"X","current_seat":1}'::jsonb,now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.match_participants(match_id,user_id,seat)
VALUES
  ('10000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000021',1),
  ('10000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000022',2),
  ('10000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000021',1),
  ('10000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000022',2)
ON CONFLICT (match_id,user_id) DO NOTHING;

INSERT INTO public.matchmaking_queue(user_id,game_id,status,rating_snapshot)
VALUES ('00000000-0000-4000-8000-000000000021','tictactoe','waiting',1000)
ON CONFLICT DO NOTHING;

-- One open room hosted by the target, and a second active room hosted by the
-- other member that the target participates in.
INSERT INTO public.private_rooms(id,host_user_id,game_id,status,max_players,expires_at,match_id)
VALUES
  ('20000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000021','tictactoe','open',2,now()+interval '24 hours',null),
  ('20000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000022','tictactoe','active',2,now()+interval '24 hours','10000000-0000-4000-8000-000000000022')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.room_members(room_id,user_id,role) VALUES
  ('20000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000021','host'),
  ('20000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000022','host'),
  ('20000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000021','player')
ON CONFLICT (room_id,user_id) DO NOTHING;

-- Snapshot economy/stats before the cleanup operation.
CREATE TEMP TABLE account_deletion_before AS
SELECT p.user_id,
       w.free_coins,w.purchased_coins,w.reward_coins,
       s.xp,s.competitive_rating,s.matches_played,s.wins,s.losses,s.draws
FROM public.member_profiles p
JOIN public.coin_wallets w ON w.user_id=p.user_id
JOIN public.member_game_stats s ON s.user_id=p.user_id AND s.game_id='tictactoe'
WHERE p.user_id IN (
  '00000000-0000-4000-8000-000000000021',
  '00000000-0000-4000-8000-000000000022'
);

-- Only the trusted server role is allowed to run this cleanup.
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT public.prepare_account_deletion('00000000-0000-4000-8000-000000000021'::uuid);
RESET ROLE;

DO $account_cleanup_check$
DECLARE
  v_count integer;
  v_status text;
  v_winner uuid;
  v_free bigint;
  v_purchased bigint;
  v_reward bigint;
  v_xp bigint;
  v_rating integer;
  v_played integer;
  v_wins integer;
  v_losses integer;
  v_draws integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.matchmaking_queue
  WHERE user_id='00000000-0000-4000-8000-000000000021' AND status='cancelled';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Account deletion did not cancel the member matchmaking queue'; END IF;

  SELECT count(*) INTO v_count
  FROM public.matches
  WHERE id IN (
    '10000000-0000-4000-8000-000000000021',
    '10000000-0000-4000-8000-000000000022'
  ) AND status='cancelled' AND winner_user_id IS NULL AND finished_at IS NOT NULL;
  IF v_count <> 2 THEN RAISE EXCEPTION 'Account deletion did not cancel all unfinished matches'; END IF;

  SELECT count(*) INTO v_count
  FROM public.match_participants
  WHERE match_id IN (
    '10000000-0000-4000-8000-000000000021',
    '10000000-0000-4000-8000-000000000022'
  ) AND final_result IS NOT NULL;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Cancelled matches must not produce a win/loss result'; END IF;

  SELECT count(*) INTO v_count
  FROM public.private_rooms
  WHERE id IN (
    '20000000-0000-4000-8000-000000000021',
    '20000000-0000-4000-8000-000000000022'
  ) AND status='closed';
  IF v_count <> 2 THEN RAISE EXCEPTION 'Account deletion must close rooms hosted by or joined by the member'; END IF;

  SELECT w.free_coins,w.purchased_coins,w.reward_coins,
         s.xp,s.competitive_rating,s.matches_played,s.wins,s.losses,s.draws
  INTO v_free,v_purchased,v_reward,v_xp,v_rating,v_played,v_wins,v_losses,v_draws
  FROM public.coin_wallets w
  JOIN public.member_game_stats s ON s.user_id=w.user_id AND s.game_id='tictactoe'
  WHERE w.user_id='00000000-0000-4000-8000-000000000021';

  IF NOT EXISTS (
    SELECT 1 FROM account_deletion_before b
    WHERE b.user_id='00000000-0000-4000-8000-000000000021'
      AND b.free_coins=v_free AND b.purchased_coins=v_purchased AND b.reward_coins=v_reward
      AND b.xp=v_xp AND b.competitive_rating=v_rating AND b.matches_played=v_played
      AND b.wins=v_wins AND b.losses=v_losses AND b.draws=v_draws
  ) THEN
    RAISE EXCEPTION 'Account deletion cleanup must not mutate coins, XP, rating, or statistics';
  END IF;

  -- Cleanup is separate from Auth Admin deletion so it can be retried safely
  -- if the subsequent deletion fails; the function itself must not delete the auth row.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id='00000000-0000-4000-8000-000000000021') THEN
    RAISE EXCEPTION 'Cleanup RPC unexpectedly deleted the auth identity';
  END IF;
END
$account_cleanup_check$;

\set ON_ERROR_STOP on

INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-000000000011','social-alpha@example.test','{"display_name":"Alpha","locale":"en"}'),
  ('00000000-0000-4000-8000-000000000012','social-beta@example.test','{"display_name":"Beta","locale":"en"}'),
  ('00000000-0000-4000-8000-000000000013','social-gamma@example.test','{"display_name":"Gamma","locale":"fa"}')
ON CONFLICT (id) DO NOTHING;

-- Test-only leaderboard grant; the platform-only database migration disables this client RPC.
UPDATE public.catalog_games SET is_enabled=true WHERE id='tictactoe';
GRANT EXECUTE ON FUNCTION public.get_game_leaderboard(text,integer) TO authenticated;
INSERT INTO public.member_game_stats(user_id,game_id,xp,competitive_rating,matches_played,wins,losses,draws)
VALUES
  ('00000000-0000-4000-8000-000000000011','tictactoe',300,1350,5,3,2,0),
  ('00000000-0000-4000-8000-000000000012','tictactoe',500,1600,7,6,1,0),
  ('00000000-0000-4000-8000-000000000013','tictactoe',100,1100,2,1,1,0)
ON CONFLICT(user_id,game_id) DO UPDATE SET
  xp=excluded.xp,competitive_rating=excluded.competitive_rating,
  matches_played=excluded.matches_played,wins=excluded.wins,losses=excluded.losses,draws=excluded.draws;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',false);

DO $social_test$
DECLARE
  v_alpha_username text := 'player_' || substr(md5('00000000-0000-4000-8000-000000000011'),1,16);
  v_beta_username text := 'player_' || substr(md5('00000000-0000-4000-8000-000000000012'),1,16);
  v_gamma_username text := 'player_' || substr(md5('00000000-0000-4000-8000-000000000013'),1,16);
  v_request_id uuid;
  v_beta_gamma_request_id uuid;
  v_cross_member_request_id uuid;
  v_status text;
  v_relationship_type text;
  v_top_username text;
  v_second_username text;
  v_rank bigint;
  v_rate_limited boolean := false;
  v_blocked boolean := false;
  i integer;
BEGIN
  SELECT request_id,relationship_status INTO v_request_id,v_status
  FROM public.send_friend_request(v_beta_username);
  IF v_request_id IS NULL OR v_status <> 'pending' THEN
    RAISE EXCEPTION 'A valid friend request should be created as pending';
  END IF;

  SELECT relationship_type INTO v_relationship_type
  FROM public.list_social_relationships() WHERE request_id=v_request_id;
  IF v_relationship_type <> 'outgoing' THEN
    RAISE EXCEPTION 'Sender should see its own request as outgoing';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',false);
  SELECT relationship_type INTO v_relationship_type
  FROM public.list_social_relationships() WHERE request_id=v_request_id;
  IF v_relationship_type <> 'incoming' THEN
    RAISE EXCEPTION 'Recipient should see an incoming request';
  END IF;

  SELECT request_id,relationship_status INTO v_request_id,v_status
  FROM public.respond_friend_request(v_request_id,'accepted');
  IF v_status <> 'accepted' THEN
    RAISE EXCEPTION 'Recipient should be able to accept their pending request';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',false);
  SELECT relationship_type INTO v_relationship_type
  FROM public.list_social_relationships() WHERE request_id=v_request_id;
  IF v_relationship_type <> 'friend' THEN
    RAISE EXCEPTION 'Both members should see an accepted request as a friend relationship';
  END IF;

  -- Repeated requests are idempotent for an existing friend, but still rate-limited.
  FOR i IN 1..4 LOOP
    SELECT relationship_status INTO v_status
    FROM public.send_friend_request(v_beta_username);
    IF v_status <> 'accepted' THEN
      RAISE EXCEPTION 'Repeated request to an existing friend must not create duplicates';
    END IF;
  END LOOP;
  BEGIN
    PERFORM public.send_friend_request(v_beta_username);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_rate_limited := true;
  END;
  IF NOT v_rate_limited THEN
    RAISE EXCEPTION 'Friend-request rate limit was not enforced after five attempts per minute';
  END IF;

  -- Only the recipient of a pending request can block it.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',false);
  SELECT request_id,relationship_status INTO v_beta_gamma_request_id,v_status
  FROM public.send_friend_request(v_gamma_username);
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Beta-to-Gamma request should start pending';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000013',false);
  SELECT relationship_status INTO v_status
  FROM public.respond_friend_request(v_cross_member_request_id,'blocked');
  IF v_status <> 'blocked' THEN
    RAISE EXCEPTION 'Recipient should be able to block a pending request';
  END IF;

  -- The blocked sender cannot send another request; API returns a generic unavailable response.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',false);
  BEGIN
    PERFORM public.send_friend_request(v_gamma_username);
  EXCEPTION WHEN SQLSTATE 'P0002' THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'A blocked relationship must prevent new friend requests';
  END IF;

  -- A third member cannot inspect or answer a relationship between two other members.
  -- Gamma sends Alpha a request; Beta must neither see it nor respond to it.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000013',false);
  SELECT request_id,relationship_status INTO v_cross_member_request_id,v_status
  FROM public.send_friend_request(v_alpha_username);
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Gamma-to-Alpha request should start pending';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',false);
  IF EXISTS (
    SELECT 1 FROM public.list_social_relationships()
    WHERE request_id=v_cross_member_request_id
  ) THEN
    RAISE EXCEPTION 'A third member must not see a relationship between two other members';
  END IF;

  v_blocked := false;
  BEGIN
    PERFORM public.respond_friend_request(v_cross_member_request_id,'accepted');
  EXCEPTION WHEN SQLSTATE 'P0002' THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'A third member must not respond to a request addressed to someone else';
  END IF;

  -- The intended recipient can still see and decline their own incoming request.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',false);
  SELECT relationship_type INTO v_relationship_type
  FROM public.list_social_relationships()
  WHERE request_id=v_cross_member_request_id;
  IF v_relationship_type <> 'incoming' THEN
    RAISE EXCEPTION 'Only the intended recipient should see this request as incoming';
  END IF;
  SELECT relationship_status INTO v_status
  FROM public.respond_friend_request(v_cross_member_request_id,'declined');
  IF v_status <> 'declined' THEN
    RAISE EXCEPTION 'The intended recipient should be able to decline their own request';
  END IF;

  -- Public-facing leaderboard is limited to enabled games and server-authored stats.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',false);
  SELECT username,rank_position INTO v_top_username,v_rank
  FROM public.get_game_leaderboard('tictactoe',10)
  WHERE rank_position=1;
  IF v_top_username <> v_beta_username OR v_rank <> 1 THEN
    RAISE EXCEPTION 'Leaderboard rank 1 should be the highest-rated player';
  END IF;

  SELECT username,rank_position INTO v_second_username,v_rank
  FROM public.get_game_leaderboard('tictactoe',10)
  WHERE rank_position=2;
  IF v_second_username <> v_alpha_username OR v_rank <> 2 THEN
    RAISE EXCEPTION 'Leaderboard rank 2 should be the second-highest-rated player';
  END IF;

  -- Disabled games never appear on the leaderboard and cannot be queried.
  BEGIN
    PERFORM * FROM public.get_game_leaderboard('chess',10);
    RAISE EXCEPTION 'Leaderboard returned a disabled game';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;
END
$social_test$;

RESET ROLE;

DO $social_admin_check$
BEGIN
  IF (SELECT count(*) FROM public.friend_requests
      WHERE sender_id='00000000-0000-4000-8000-000000000011'
        AND recipient_id='00000000-0000-4000-8000-000000000012') <> 1 THEN
    RAISE EXCEPTION 'Repeated request attempts must not create duplicate friend rows';
  END IF;
  IF (SELECT count(*) FROM public.friend_requests
      WHERE sender_id='00000000-0000-4000-8000-000000000012'
        AND recipient_id='00000000-0000-4000-8000-000000000013'
        AND status='blocked') <> 1 THEN
    RAISE EXCEPTION 'The blocked relationship must be persisted server-side';
  END IF;
  IF (SELECT count(*) FROM public.social_action_events
      WHERE user_id='00000000-0000-4000-8000-000000000011'
        AND event_type='send_friend_request') <> 5 THEN
    RAISE EXCEPTION 'All accepted attempts before the rate limit must be counted; the over-limit call must be rejected';
  END IF;
END
$social_admin_check$;

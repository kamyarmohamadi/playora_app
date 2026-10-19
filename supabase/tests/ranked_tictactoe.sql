\set ON_ERROR_STOP on

-- This test runs after the base RLS isolation test in the same disposable PostgreSQL DB.
-- It validates server-authoritative matchmaking/moves and the 24-hour rematch guard.
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-000000000001','one@example.test','{"display_name":"Member One","locale":"en"}'),
  ('00000000-0000-4000-8000-000000000002','two@example.test','{"display_name":"Member Two","locale":"fa"}')
ON CONFLICT (id) DO NOTHING;

UPDATE public.catalog_games SET is_enabled = true WHERE id = 'tictactoe';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);

DO $ranked_tictactoe$
DECLARE
  v_status text;
  v_match_id uuid;
  v_against_turn boolean := false;
  v_occupied_cell boolean := false;
  v_completed boolean := false;
  v_winner_id uuid;
  v_xp bigint;
  v_rating integer;
  v_wins integer;
  v_losses integer;
  v_rematch_status text;
  v_cancelled boolean;
BEGIN
  -- Member One enters the queue. This call must not accept an opponent ID.
  SELECT queue_status, matched_match_id INTO v_status, v_match_id
  FROM public.queue_for_random_match('tictactoe');
  IF v_status <> 'waiting' OR v_match_id IS NOT NULL THEN
    RAISE EXCEPTION 'First member should wait for random matchmaking';
  END IF;

  -- Member Two enters; the server selects the waiting opponent and creates one match.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
  SELECT queue_status, matched_match_id INTO v_status, v_match_id
  FROM public.queue_for_random_match('tictactoe');
  IF v_status <> 'matched' OR v_match_id IS NULL THEN
    RAISE EXCEPTION 'Second member should be matched to the waiting opponent';
  END IF;

  -- RLS intentionally exposes only the signed-in member's participant row.
  IF (SELECT count(*) FROM public.match_participants WHERE match_id=v_match_id) <> 1 THEN
    RAISE EXCEPTION 'Member should see only their own participant row';
  END IF;
  IF (SELECT count(*) FROM public.matches WHERE id=v_match_id AND mode='ranked' AND status='active') <> 1 THEN
    RAISE EXCEPTION 'Match must begin active and ranked';
  END IF;

  -- Member Two is seat 2 and cannot move before seat 1.
  BEGIN
    PERFORM public.submit_tictactoe_move(v_match_id,0);
    v_against_turn := false;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_against_turn := true;
  END;
  IF NOT v_against_turn THEN RAISE EXCEPTION 'Out-of-turn move was accepted'; END IF;

  -- Seat 1 (X) makes the first move.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
  PERFORM public.submit_tictactoe_move(v_match_id,0);

  -- Seat 2 must not overwrite an occupied cell.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
  BEGIN
    PERFORM public.submit_tictactoe_move(v_match_id,0);
    v_occupied_cell := false;
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_occupied_cell := true;
  END;
  IF NOT v_occupied_cell THEN RAISE EXCEPTION 'Move into occupied cell was accepted'; END IF;

  PERFORM public.submit_tictactoe_move(v_match_id,3); -- O
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
  PERFORM public.submit_tictactoe_move(v_match_id,1); -- X
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
  PERFORM public.submit_tictactoe_move(v_match_id,4); -- O
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
  PERFORM public.submit_tictactoe_move(v_match_id,2); -- X wins

  SELECT status='completed' INTO v_completed
  FROM public.matches WHERE id=v_match_id;
  IF NOT v_completed OR (SELECT final_result FROM public.match_participants WHERE match_id=v_match_id AND user_id=auth.uid()) <> 'loss' THEN
    RAISE EXCEPTION 'Authoritative member-visible match result was not recorded correctly';
  END IF;

  SELECT xp,competitive_rating,wins INTO v_xp,v_rating,v_wins
  FROM public.member_game_stats
  WHERE user_id='00000000-0000-4000-8000-000000000001' AND game_id='tictactoe';
  IF v_xp <> 20 OR v_rating <> 1016 OR v_wins <> 1 THEN
    RAISE EXCEPTION 'Unexpected winner XP/rating/stats: xp %, rating %, wins %',v_xp,v_rating,v_wins;
  END IF;

  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
  SELECT xp,competitive_rating,losses INTO v_xp,v_rating,v_losses
  FROM public.member_game_stats
  WHERE user_id=auth.uid() AND game_id='tictactoe';
  IF v_xp <> 6 OR v_rating <> 984 OR v_losses <> 1 THEN
    RAISE EXCEPTION 'Unexpected loser XP/rating/stats: xp %, rating %, losses %',v_xp,v_rating,v_losses;
  END IF;

  -- Neither participant can continue moving after the authoritative match completes.
  BEGIN
    PERFORM public.submit_tictactoe_move(v_match_id,5);
    v_against_turn := false;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_against_turn := true;
  END;
  IF NOT v_against_turn THEN RAISE EXCEPTION 'Move after match completion was accepted'; END IF;

  -- Queue both members again. Even though both are waiting, their recent rematch
  -- must be filtered out for 24 hours; both members remain queued, not matched.
  SELECT queue_status INTO v_rematch_status FROM public.queue_for_random_match('tictactoe');
  IF v_rematch_status <> 'waiting' THEN
    RAISE EXCEPTION 'Member Two should wait rather than immediately rematch the same opponent';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
  SELECT queue_status INTO v_rematch_status FROM public.queue_for_random_match('tictactoe');
  IF v_rematch_status <> 'waiting' THEN
    RAISE EXCEPTION 'Recent-opponent rematch should be suppressed for 24 hours';
  END IF;

  SELECT cancel_random_match_queue('tictactoe') INTO v_cancelled;
  IF NOT v_cancelled THEN RAISE EXCEPTION 'Member One could not cancel their own queue entry'; END IF;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
  SELECT cancel_random_match_queue('tictactoe') INTO v_cancelled;
  IF NOT v_cancelled THEN RAISE EXCEPTION 'Member Two could not cancel their own queue entry'; END IF;
END
$ranked_tictactoe$;

RESET ROLE;

-- As the database test owner, verify both participant rows exist behind the RLS boundary.
DO $ranked_admin_integrity$
DECLARE
  v_match_id uuid;
  v_participant_count integer;
  v_winner_id uuid;
  v_win_rows integer;
  v_loss_rows integer;
BEGIN
  SELECT id,winner_user_id INTO v_match_id,v_winner_id
  FROM public.matches
  WHERE game_id='tictactoe' AND mode='ranked' AND status='completed'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'No completed ranked match was persisted';
  END IF;
  SELECT count(*) INTO v_participant_count FROM public.match_participants WHERE match_id=v_match_id;
  IF v_participant_count <> 2 THEN
    RAISE EXCEPTION 'Server must persist exactly two match participants; got %',v_participant_count;
  END IF;
  IF v_winner_id <> '00000000-0000-4000-8000-000000000001'::uuid THEN
    RAISE EXCEPTION 'Completed match winner does not match server-validated X win';
  END IF;
  SELECT count(*) INTO v_win_rows FROM public.match_participants WHERE match_id=v_match_id AND final_result='win';
  SELECT count(*) INTO v_loss_rows FROM public.match_participants WHERE match_id=v_match_id AND final_result='loss';
  IF v_win_rows <> 1 OR v_loss_rows <> 1 THEN
    RAISE EXCEPTION 'Match must persist one win and one loss result';
  END IF;
END
$ranked_admin_integrity$;

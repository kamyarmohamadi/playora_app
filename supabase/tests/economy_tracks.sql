\set ON_ERROR_STOP on

INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('00000000-0000-4000-8000-000000000010','tracks-one@example.test','{"display_name":"Track One","locale":"en"}')
ON CONFLICT(id) DO NOTHING;

DO $track_schema$
DECLARE
  v_columns integer;
  v_primary_key text;
BEGIN
  SELECT count(*) INTO v_columns FROM information_schema.columns
  WHERE table_schema='public' AND table_name='member_game_stats'
    AND column_name='economy_mode' AND is_nullable='NO';
  IF v_columns <> 1 THEN RAISE EXCEPTION 'member_game_stats.economy_mode must be NOT NULL'; END IF;

  SELECT string_agg(a.attname,',' ORDER BY k.ordinality) INTO v_primary_key
  FROM pg_constraint c
  JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(attnum,ordinality) ON true
  JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
  WHERE c.conrelid='public.member_game_stats'::regclass AND c.contype='p';
  IF v_primary_key <> 'user_id,game_id,economy_mode' THEN
    RAISE EXCEPTION 'Expected composite stat key user_id,game_id,economy_mode; got %',v_primary_key;
  END IF;

  IF (SELECT purchased_coins FROM public.coin_wallets WHERE user_id='00000000-0000-4000-8000-000000000010') <> 50
     OR (SELECT free_coins FROM public.coin_wallets WHERE user_id='00000000-0000-4000-8000-000000000010') <> 0 THEN
    RAISE EXCEPTION 'Signup gift must be 50 Value Wallet coins and no free coins';
  END IF;

  IF (SELECT count(*) FROM public.coin_ledger WHERE user_id='00000000-0000-4000-8000-000000000010'
      AND event_type='signup_bonus' AND bucket='purchased' AND amount=50) <> 1 THEN
    RAISE EXCEPTION 'Signup gift ledger must record one paid-value gift';
  END IF;
END
$track_schema$;

-- Track-local progression: advancing Free must not move Paid.
INSERT INTO public.member_game_stats(user_id,game_id,economy_mode,xp,competitive_rating,matches_played,wins,losses)
VALUES
 ('00000000-0000-4000-8000-000000000010','chess','free',700,1320,10,7,3),
 ('00000000-0000-4000-8000-000000000010','chess','paid',0,1000,0,0,0)
ON CONFLICT(user_id,game_id,economy_mode) DO UPDATE
SET xp=excluded.xp,competitive_rating=excluded.competitive_rating,matches_played=excluded.matches_played,
    wins=excluded.wins,losses=excluded.losses;

UPDATE public.member_game_stats
SET xp=xp+20,competitive_rating=competitive_rating+16,matches_played=matches_played+1,wins=wins+1
WHERE user_id='00000000-0000-4000-8000-000000000010' AND game_id='chess' AND economy_mode='free';

DO $track_isolation$
BEGIN
  IF (SELECT xp FROM public.member_game_stats WHERE user_id='00000000-0000-4000-8000-000000000010' AND game_id='chess' AND economy_mode='paid') <> 0 THEN
    RAISE EXCEPTION 'Free progression leaked into Paid XP';
  END IF;
  IF (SELECT competitive_rating FROM public.member_game_stats WHERE user_id='00000000-0000-4000-8000-000000000010' AND game_id='chess' AND economy_mode='paid') <> 1000 THEN
    RAISE EXCEPTION 'Free progression leaked into Paid Rating';
  END IF;
  IF (SELECT xp FROM public.member_game_stats WHERE user_id='00000000-0000-4000-8000-000000000010' AND game_id='chess' AND economy_mode='free') <> 720 THEN
    RAISE EXCEPTION 'Free track XP update was not persisted';
  END IF;
END
$track_isolation$;

-- Match economy classification may not be rewritten after creation.
INSERT INTO public.matches(id,game_id,mode,economy_mode,status,server_state)
VALUES('00000000-0000-4000-8000-000000000010','tictactoe','ranked','paid','created','{}'::jsonb);

DO $immutable_mode$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    UPDATE public.matches SET economy_mode='free'
    WHERE id='00000000-0000-4000-8000-000000000010';
  EXCEPTION WHEN SQLSTATE '22023' THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Match economy_mode was mutable'; END IF;
END
$immutable_mode$;


-- Every member must have both tracks for every currently catalogued game.
DO $all_game_tracks$
DECLARE
  v_members integer;
  v_games integer;
  v_rows integer;
BEGIN
  SELECT count(*) INTO v_members FROM public.member_profiles;
  SELECT count(*) INTO v_games FROM public.catalog_games;
  SELECT count(*) INTO v_rows FROM public.member_game_stats;
  IF v_rows <> v_members * v_games * 2 THEN
    RAISE EXCEPTION 'Expected two progression rows per member/game; members %, games %, rows %',v_members,v_games,v_rows;
  END IF;
  IF has_function_privilege('authenticated','public.get_game_leaderboard_for_mode(text,text,integer)','EXECUTE') IS NOT true THEN
    RAISE EXCEPTION 'Authenticated clients must be able to read the mode-scoped leaderboard RPC';
  END IF;
END
$all_game_tracks$;

-- Future catalog additions automatically receive both independent progression rows.
INSERT INTO public.catalog_games(id,title_en,title_fa,category)
VALUES('economy_test_game','Economy Test','بازی آزمایشی اقتصاد','board');
DO $future_game_tracks$
DECLARE v_rows integer;
BEGIN
  SELECT count(*) INTO v_rows FROM public.member_game_stats WHERE game_id='economy_test_game';
  IF v_rows <> (SELECT count(*) FROM public.member_profiles) * 2 THEN
    RAISE EXCEPTION 'Future game catalog trigger did not seed both tracks; rows %',v_rows;
  END IF;
END
$future_game_tracks$;
DELETE FROM public.catalog_games WHERE id='economy_test_game';

RESET ROLE;

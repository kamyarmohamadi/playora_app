\set ON_ERROR_STOP on
-- Two independent synthetic users; the migration's signup trigger creates their private rows.
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-000000000001','one@example.test','{"display_name":"Member One","locale":"en"}'),
  ('00000000-0000-4000-8000-000000000002','two@example.test','{"display_name":"Member Two","locale":"fa"}')
ON CONFLICT (id) DO NOTHING;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);

DO $member_one$
DECLARE visible_count integer;
DECLARE current_coins bigint;
DECLARE affected integer;
BEGIN
  SELECT count(*) INTO visible_count FROM public.member_profiles;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'Member One can see % profiles, expected 1', visible_count; END IF;
  SELECT count(*) INTO visible_count FROM public.coin_wallets;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'Member One can see % wallets, expected 1', visible_count; END IF;
  SELECT free_coins INTO current_coins FROM public.coin_wallets WHERE user_id = auth.uid();
  IF current_coins <> 50 THEN RAISE EXCEPTION 'New member demo wallet was not initialized to 50'; END IF;
  SELECT count(*) INTO visible_count FROM public.coin_ledger;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'Member One can see % ledger rows, expected 1', visible_count; END IF;
  SELECT count(*) INTO visible_count FROM public.member_favorites;
  IF visible_count <> 0 THEN RAISE EXCEPTION 'Unexpected pre-existing favorites for Member One'; END IF;

  INSERT INTO public.member_favorites(user_id,game_id) VALUES(auth.uid(),'chess');
  SELECT count(*) INTO visible_count FROM public.member_favorites;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'Member One could not see their own favorite'; END IF;

  UPDATE public.member_profiles SET display_name = 'Attempt To Edit Member Two'
  WHERE user_id = '00000000-0000-4000-8000-000000000002';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Member One updated Member Two profile'; END IF;

  BEGIN
    UPDATE public.coin_wallets SET free_coins = 999 WHERE user_id = auth.uid();
    RAISE EXCEPTION 'Authenticated client changed its own authoritative wallet directly';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$member_one$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);

DO $member_two$
DECLARE visible_count integer;
DECLARE current_coins bigint;
DECLARE affected integer;
BEGIN
  SELECT count(*) INTO visible_count FROM public.member_profiles;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'Member Two can see % profiles, expected 1', visible_count; END IF;
  SELECT count(*) INTO visible_count FROM public.coin_wallets;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'Member Two can see % wallets, expected 1', visible_count; END IF;
  SELECT free_coins INTO current_coins FROM public.coin_wallets WHERE user_id = auth.uid();
  IF current_coins <> 50 THEN RAISE EXCEPTION 'Member Two wallet has unexpected balance'; END IF;
  SELECT count(*) INTO visible_count FROM public.coin_ledger;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'Member Two can see % ledger rows, expected 1', visible_count; END IF;
  SELECT count(*) INTO visible_count FROM public.member_favorites;
  IF visible_count <> 0 THEN RAISE EXCEPTION 'Member Two can see Member One favorites'; END IF;

  UPDATE public.member_profiles SET display_name = 'Attempt To Edit Member One'
  WHERE user_id = '00000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Member Two updated Member One profile'; END IF;
END
$member_two$;

RESET ROLE;

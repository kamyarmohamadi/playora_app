-- Run with psql against a disposable Supabase test database AFTER the migration.
-- This is a static security-invariant check. It is not a substitute for two-user RLS integration tests.
DO $playora_security$
DECLARE
  table_name text;
  rls_enabled boolean;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'member_profiles','member_preferences','coin_wallets','coin_ledger','catalog_games',
    'member_favorites','matches','match_participants','member_game_stats','matchmaking_queue',
    'private_rooms','private_room_secrets','room_members','friend_requests','tournaments',
    'tournament_entries','deposit_requests','security_audit_events'
  ] LOOP
    SELECT c.relrowsecurity INTO rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = table_name AND c.relkind = 'r';

    IF rls_enabled IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'RLS is missing or disabled for public.%', table_name;
    END IF;
  END LOOP;

  IF has_table_privilege('authenticated','public.member_game_stats','INSERT')
     OR has_table_privilege('authenticated','public.member_game_stats','UPDATE')
     OR has_table_privilege('authenticated','public.member_game_stats','DELETE') THEN
    RAISE EXCEPTION 'Authenticated role must not mutate server-owned ratings or XP';
  END IF;

  IF has_table_privilege('authenticated','public.matchmaking_queue','INSERT')
     OR has_table_privilege('authenticated','public.matchmaking_queue','UPDATE')
     OR has_table_privilege('authenticated','public.matchmaking_queue','DELETE') THEN
    RAISE EXCEPTION 'Authenticated role must not mutate matchmaking queue rows directly';
  END IF;

  IF has_function_privilege('anon','public.queue_for_random_match(text)','EXECUTE')
     OR has_function_privilege('anon','public.submit_tictactoe_move(uuid,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role must not invoke online matchmaking or move RPCs';
  END IF;

  IF NOT has_function_privilege('authenticated','public.queue_for_random_match(text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.cancel_random_match_queue(text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.submit_tictactoe_move(uuid,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated member must have execute permission for approved own-session RPCs';
  END IF;

  IF has_table_privilege('authenticated','public.coin_wallets','INSERT')
     OR has_table_privilege('authenticated','public.coin_wallets','UPDATE')
     OR has_table_privilege('authenticated','public.coin_wallets','DELETE') THEN
    RAISE EXCEPTION 'Authenticated role must not mutate coin_wallets directly';
  END IF;

  IF has_table_privilege('authenticated','public.coin_ledger','INSERT')
     OR has_table_privilege('authenticated','public.coin_ledger','UPDATE')
     OR has_table_privilege('authenticated','public.coin_ledger','DELETE') THEN
    RAISE EXCEPTION 'Authenticated role must not mutate coin_ledger directly';
  END IF;

  IF has_table_privilege('authenticated','public.deposit_requests','INSERT')
     OR has_table_privilege('authenticated','public.deposit_requests','UPDATE')
     OR has_table_privilege('authenticated','public.deposit_requests','DELETE') THEN
    RAISE EXCEPTION 'Authenticated role must not mutate deposit requests directly';
  END IF;

  IF has_table_privilege('authenticated','public.matches','INSERT')
     OR has_table_privilege('authenticated','public.matches','UPDATE')
     OR has_table_privilege('authenticated','public.matches','DELETE') THEN
    RAISE EXCEPTION 'Authenticated role must not mutate authoritative match state';
  END IF;

  IF has_table_privilege('authenticated','public.private_room_secrets','SELECT')
     OR has_table_privilege('authenticated','public.private_room_secrets','INSERT')
     OR has_table_privilege('authenticated','public.private_room_secrets','UPDATE')
     OR has_table_privilege('authenticated','public.private_room_secrets','DELETE') THEN
    RAISE EXCEPTION 'Authenticated role must not access private room secret hashes';
  END IF;

  IF has_table_privilege('authenticated','public.coin_ledger','UPDATE')
     OR has_table_privilege('authenticated','public.coin_ledger','DELETE') THEN
    RAISE EXCEPTION 'Authenticated role must not mutate ledger entries';
  END IF;

  IF has_function_privilege('authenticated','public.apply_coin_delta(uuid,text,bigint,text,text,text)','EXECUTE')
     OR has_function_privilege('anon','public.apply_coin_delta(uuid,text,bigint,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Wallet mutation RPC must not be executable by client roles';
  END IF;

  IF NOT has_function_privilege('service_role','public.apply_coin_delta(uuid,text,bigint,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Trusted server role must be able to call wallet mutation RPC';
  END IF;

  IF has_column_privilege('authenticated','public.member_profiles','username','UPDATE')
     OR has_column_privilege('authenticated','public.member_profiles','user_id','UPDATE') THEN
    RAISE EXCEPTION 'Member must not edit profile identity fields';
  END IF;
END
$playora_security$;

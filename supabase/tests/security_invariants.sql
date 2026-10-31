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
    'tournament_entries','deposit_requests','security_audit_events','social_action_events',
    'game_plugin_artifact_origins','game_plugin_versions', 'support_reports',
    'withdrawal_requests','member_gate_verifications','member_payout_addresses','deposit_network_configs','withdrawal_network_configs',
    'deposit_tx_first_claims','deposit_tx_duplicate_attempts','paid_coin_lots','paid_coin_lot_consumptions'
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
     OR has_function_privilege('anon','public.cancel_random_match_queue(text)','EXECUTE')
     OR has_function_privilege('anon','public.submit_tictactoe_move(uuid,integer)','EXECUTE')
     OR has_function_privilege('authenticated','public.queue_for_random_match(text)','EXECUTE')
     OR has_function_privilege('authenticated','public.cancel_random_match_queue(text)','EXECUTE')
     OR has_function_privilege('authenticated','public.submit_tictactoe_move(uuid,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Ranked game RPCs must remain disabled for client roles before a game plugin is approved';
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

  IF has_table_privilege('authenticated','public.member_payout_addresses','INSERT')
     OR has_table_privilege('authenticated','public.member_payout_addresses','UPDATE')
     OR has_table_privilege('authenticated','public.member_payout_addresses','DELETE') THEN
    RAISE EXCEPTION 'Members may only read their own payout addresses, not change verification state';
  END IF;

  IF has_table_privilege('authenticated','public.deposit_requests','INSERT')
     OR has_table_privilege('authenticated','public.deposit_requests','UPDATE')
     OR has_table_privilege('authenticated','public.deposit_requests','DELETE') THEN
    RAISE EXCEPTION 'Authenticated role must not mutate deposit requests directly';
  END IF;

  IF has_column_privilege('authenticated','public.matches','winner_user_id','SELECT') THEN
    RAISE EXCEPTION 'Authenticated members must not directly read match winner auth UUIDs';
  END IF;

  IF has_column_privilege('authenticated','public.private_rooms','host_user_id','SELECT') THEN
    RAISE EXCEPTION 'Authenticated members must not directly read private-room host auth UUIDs';
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

  IF has_table_privilege('authenticated','public.private_room_secrets','SELECT')
     OR has_table_privilege('authenticated','public.private_room_secrets','INSERT')
     OR has_table_privilege('authenticated','public.private_room_secrets','UPDATE')
     OR has_table_privilege('authenticated','public.private_room_secrets','DELETE') THEN
    RAISE EXCEPTION 'Private-room invite hashes must never be accessible to client roles';
  END IF;

  IF has_table_privilege('authenticated','public.private_rooms','INSERT')
     OR has_table_privilege('authenticated','public.private_rooms','UPDATE')
     OR has_table_privilege('authenticated','public.private_rooms','DELETE')
     OR has_table_privilege('authenticated','public.room_members','INSERT')
     OR has_table_privilege('authenticated','public.room_members','UPDATE')
     OR has_table_privilege('authenticated','public.room_members','DELETE') THEN
    RAISE EXCEPTION 'Members must use room RPCs rather than writing room state directly';
  END IF;

  IF has_function_privilege('authenticated','public.hash_room_invite_code(text)','EXECUTE')
     OR has_function_privilege('anon','public.hash_room_invite_code(text)','EXECUTE') THEN
    RAISE EXCEPTION 'Invite-code hashing helper must not be directly callable by client roles';
  END IF;

  IF has_function_privilege('anon','public.create_private_room(text,integer)','EXECUTE')
     OR has_function_privilege('anon','public.join_private_room(text)','EXECUTE')
     OR has_function_privilege('anon','public.leave_private_room(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.submit_private_tictactoe_move(uuid,integer)','EXECUTE')
     OR has_function_privilege('authenticated','public.create_private_room(text,integer)','EXECUTE')
     OR has_function_privilege('authenticated','public.join_private_room(text)','EXECUTE')
     OR has_function_privilege('authenticated','public.leave_private_room(uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.submit_private_tictactoe_move(uuid,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Private-room game RPCs must remain disabled for client roles until an approved game plugin ships';
  END IF;

  IF has_table_privilege('authenticated','public.friend_requests','SELECT') THEN
    RAISE EXCEPTION 'Friend relationship UUIDs must be read only through scoped RPCs';
  END IF;

  IF has_table_privilege('authenticated','public.friend_requests','INSERT')
     OR has_table_privilege('authenticated','public.friend_requests','UPDATE')
     OR has_table_privilege('authenticated','public.friend_requests','DELETE') THEN
    RAISE EXCEPTION 'Friend relationships must be changed through authorized RPCs';
  END IF;

  IF has_table_privilege('authenticated','public.social_action_events','SELECT')
     OR has_table_privilege('authenticated','public.social_action_events','INSERT')
     OR has_table_privilege('authenticated','public.social_action_events','UPDATE')
     OR has_table_privilege('authenticated','public.social_action_events','DELETE') THEN
    RAISE EXCEPTION 'Social anti-spam event records must not be client-accessible';
  END IF;

  IF has_function_privilege('anon','public.list_social_relationships()','EXECUTE')
     OR has_function_privilege('anon','public.send_friend_request(text)','EXECUTE')
     OR has_function_privilege('anon','public.respond_friend_request(uuid,text)','EXECUTE')
     OR has_function_privilege('anon','public.get_game_leaderboard(text,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous clients must not invoke social/leaderboard RPCs';
  END IF;

  IF NOT has_function_privilege('authenticated','public.list_social_relationships()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.send_friend_request(text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.respond_friend_request(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated members must be able to use approved scoped social RPCs';
  END IF;

  IF has_function_privilege('authenticated','public.get_game_leaderboard(text,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Game leaderboard RPC must remain disabled until a game plugin is approved';
  END IF;

  IF has_function_privilege('authenticated','public.prepare_account_deletion(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.prepare_account_deletion(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Account deletion cleanup must not be callable by client roles';
  END IF;
  IF NOT has_function_privilege('service_role','public.prepare_account_deletion(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Trusted server role must be able to prepare account deletion';
  END IF;

  IF has_column_privilege('authenticated','public.member_profiles','username','UPDATE')
     OR has_column_privilege('authenticated','public.member_profiles','user_id','UPDATE') THEN
    RAISE EXCEPTION 'Member must not edit profile identity fields';
  END IF;

  IF has_table_privilege('anon','public.support_reports','SELECT')
     OR has_table_privilege('anon','public.support_reports','INSERT')
     OR has_table_privilege('authenticated','public.support_reports','UPDATE')
     OR has_table_privilege('authenticated','public.support_reports','DELETE') THEN
    RAISE EXCEPTION 'Support reports must be private and immutable to browser clients';
  END IF;


  IF has_table_privilege('authenticated','public.deposit_requests','INSERT')
     OR has_table_privilege('authenticated','public.deposit_requests','UPDATE')
     OR has_table_privilege('authenticated','public.deposit_requests','DELETE')
     OR has_table_privilege('authenticated','public.withdrawal_requests','INSERT')
     OR has_table_privilege('authenticated','public.withdrawal_requests','UPDATE')
     OR has_table_privilege('authenticated','public.withdrawal_requests','DELETE')
     OR has_table_privilege('authenticated','public.member_gate_verifications','INSERT')
     OR has_table_privilege('authenticated','public.member_gate_verifications','UPDATE')
     OR has_table_privilege('authenticated','public.member_gate_verifications','DELETE') THEN
    RAISE EXCEPTION 'Members may read their own financial status but cannot mutate financial or verification records directly';
  END IF;

  IF has_table_privilege('authenticated','public.deposit_network_configs','SELECT')
     OR has_table_privilege('authenticated','public.withdrawal_network_configs','SELECT')
     OR has_table_privilege('authenticated','public.deposit_tx_first_claims','SELECT')
     OR has_table_privilege('authenticated','public.deposit_tx_duplicate_attempts','SELECT')
     OR has_table_privilege('authenticated','public.paid_coin_lots','SELECT')
     OR has_table_privilege('authenticated','public.paid_coin_lot_consumptions','SELECT') THEN
    RAISE EXCEPTION 'Private network configuration, transaction claim indexes and Value Wallet provenance must not be directly exposed';
  END IF;

  IF has_function_privilege('anon','public.get_deposit_options()','EXECUTE')
     OR has_function_privilege('anon','public.get_withdrawal_options()','EXECUTE')
     OR has_function_privilege('anon','public.submit_deposit_claim(text,text,numeric,text,timestamptz)','EXECUTE')
     OR has_function_privilege('anon','public.request_withdrawal(bigint,uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.review_deposit_request(uuid,boolean,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.review_withdrawal_request(uuid,text,text,numeric,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.set_member_gate_verification(uuid,boolean,boolean,boolean)','EXECUTE')
     OR has_function_privilege('authenticated','public.complete_paid_match_turnover(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Financial review, verification and turnover settlement must remain server-only';
  END IF;

  IF has_function_privilege('anon','public.register_member_payout_address(text,text,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.review_member_payout_address(uuid,boolean,text)','EXECUTE')
     OR has_function_privilege('anon','public.review_member_payout_address(uuid,boolean,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Payout address registration is member-scoped and verification is server-only';
  END IF;

  IF NOT has_function_privilege('authenticated','public.register_member_payout_address(text,text,text)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.review_member_payout_address(uuid,boolean,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Payout address registration/review grants are incorrect';
  END IF;

  IF NOT has_function_privilege('authenticated','public.get_deposit_options()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.get_withdrawal_options()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.submit_deposit_claim(text,text,numeric,text,timestamptz)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.request_withdrawal(bigint,uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.get_my_financial_summary()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.get_member_game_access(text)','EXECUTE') THEN
    RAISE EXCEPTION 'Signed-in members must be able to use their scoped financial request and status APIs';
  END IF;

  IF NOT has_function_privilege('service_role','public.review_deposit_request(uuid,boolean,text)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.review_withdrawal_request(uuid,text,text,numeric,text)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.set_member_gate_verification(uuid,boolean,boolean,boolean)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.complete_paid_match_turnover(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Trusted server must be able to review financial requests and settle verified turnover';
  END IF;

  IF EXISTS (SELECT 1 FROM public.catalog_games WHERE is_enabled = true) THEN
    RAISE EXCEPTION 'No game may be launchable in the platform-only staging migration baseline';
  END IF;
END
$playora_security$;

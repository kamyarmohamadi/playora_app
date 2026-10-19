-- Run with psql against a disposable Supabase test database AFTER the migration.
-- This is a static security-invariant check. It is not a substitute for two-user RLS integration tests.
DO $playora_security$
DECLARE
  table_name text;
  rls_enabled boolean;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'member_profiles','member_preferences','coin_wallets','coin_ledger','catalog_games',
    'member_favorites','matches','match_participants','private_rooms','private_room_secrets',
    'room_members','friend_requests','tournaments','tournament_entries','deposit_requests',
    'security_audit_events'
  ] LOOP
    SELECT c.relrowsecurity INTO rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = table_name AND c.relkind = 'r';

    IF rls_enabled IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'RLS is missing or disabled for public.%', table_name;
    END IF;
  END LOOP;

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

  IF has_column_privilege('authenticated','public.member_profiles','username','UPDATE')
     OR has_column_privilege('authenticated','public.member_profiles','user_id','UPDATE') THEN
    RAISE EXCEPTION 'Member must not edit profile identity fields';
  END IF;
END
$playora_security$;

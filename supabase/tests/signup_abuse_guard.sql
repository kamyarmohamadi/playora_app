\set ON_ERROR_STOP on

-- The before-user-created hook receives the source IP from Supabase Auth.
-- Its install identifier is a random UUID stored by the app; only its hash is persisted.
SET ROLE supabase_auth_admin;
DO $device_hook_allows_first_account$
DECLARE
  v_result jsonb;
BEGIN
  v_result:=public.hook_playora_before_user_created(jsonb_build_object(
    'metadata',jsonb_build_object('ip_address','198.51.100.10'),
    'user',jsonb_build_object(
      'id','00000000-0000-4000-8000-000000000101',
      'user_metadata',jsonb_build_object('playora_install_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    )
  ));
  IF v_result<>'{}'::jsonb THEN
    RAISE EXCEPTION 'First account on a new device should be allowed: %',v_result;
  END IF;
END
$device_hook_allows_first_account$;
RESET ROLE;

INSERT INTO auth.users(id,email,raw_user_meta_data)
VALUES(
 '00000000-0000-4000-8000-000000000101',
 'device-first@example.test',
 '{"playora_install_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}'
);

SET ROLE supabase_auth_admin;
DO $device_hook_rejects_second_account$
DECLARE
  v_result jsonb;
BEGIN
  v_result:=public.hook_playora_before_user_created(jsonb_build_object(
    'metadata',jsonb_build_object('ip_address','203.0.113.77'),
    'user',jsonb_build_object(
      'id','00000000-0000-4000-8000-000000000102',
      'user_metadata',jsonb_build_object('playora_install_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    )
  ));
  IF v_result->'error'->>'http_code'<>'403'
     OR v_result->'error'->>'message' NOT ILIKE '%already linked%' THEN
    RAISE EXCEPTION 'A second account on the same install must be blocked: %',v_result;
  END IF;
END
$device_hook_rejects_second_account$;

-- Three legitimate accounts may share one public IP within a rolling day
-- (e.g. household/shared carrier NAT); the fourth new account is throttled.
DO $ip_limit_allows_three$
DECLARE
  v_result jsonb;
BEGIN
  v_result:=public.hook_playora_before_user_created(jsonb_build_object(
    'metadata',jsonb_build_object('ip_address','198.51.100.20'),
    'user',jsonb_build_object('id','00000000-0000-4000-8000-000000000201',
      'user_metadata',jsonb_build_object('playora_install_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'))
  ));
  IF v_result<>'{}'::jsonb THEN RAISE EXCEPTION 'First IP account should be allowed: %',v_result; END IF;
  v_result:=public.hook_playora_before_user_created(jsonb_build_object(
    'metadata',jsonb_build_object('ip_address','198.51.100.20'),
    'user',jsonb_build_object('id','00000000-0000-4000-8000-000000000202',
      'user_metadata',jsonb_build_object('playora_install_id','cccccccc-cccc-4ccc-8ccc-cccccccccccc'))
  ));
  IF v_result<>'{}'::jsonb THEN RAISE EXCEPTION 'Second IP account should be allowed: %',v_result; END IF;
  v_result:=public.hook_playora_before_user_created(jsonb_build_object(
    'metadata',jsonb_build_object('ip_address','198.51.100.20'),
    'user',jsonb_build_object('id','00000000-0000-4000-8000-000000000203',
      'user_metadata',jsonb_build_object('playora_install_id','dddddddd-dddd-4ddd-8ddd-dddddddddddd'))
  ));
  IF v_result<>'{}'::jsonb THEN RAISE EXCEPTION 'Third IP account should be allowed: %',v_result; END IF;
END
$ip_limit_allows_three$;
RESET ROLE;

INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('00000000-0000-4000-8000-000000000201','device-201@example.test','{"playora_install_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}'),
 ('00000000-0000-4000-8000-000000000202','device-202@example.test','{"playora_install_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}'),
 ('00000000-0000-4000-8000-000000000203','device-203@example.test','{"playora_install_id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}');

SET ROLE supabase_auth_admin;
DO $ip_limit_rejects_fourth$
DECLARE
  v_result jsonb;
BEGIN
  v_result:=public.hook_playora_before_user_created(jsonb_build_object(
    'metadata',jsonb_build_object('ip_address','198.51.100.20'),
    'user',jsonb_build_object('id','00000000-0000-4000-8000-000000000204',
      'user_metadata',jsonb_build_object('playora_install_id','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'))
  ));
  IF v_result->'error'->>'http_code'<>'429'
     OR v_result->'error'->>'message' NOT ILIKE '%Too many new Playora accounts%' THEN
    RAISE EXCEPTION 'Fourth IP account in 24 hours must be rate-limited: %',v_result;
  END IF;
END
$ip_limit_rejects_fourth$;
RESET ROLE;

-- OAuth providers may not supply custom user_metadata before account creation.
-- After the first authenticated session, the app binds its installation ID
-- through a user-scoped RPC. The same account may use additional devices;
-- a different account cannot claim an already-bound installation.
SET ROLE supabase_auth_admin;
DO $oauth_hook_allows_ip_limited_signup$
DECLARE v_result jsonb;
BEGIN
  v_result:=public.hook_playora_before_user_created(jsonb_build_object(
    'metadata',jsonb_build_object('ip_address','203.0.113.88'),
    'user',jsonb_build_object('id','00000000-0000-4000-8000-000000000301','user_metadata','{}'::jsonb)
  ));
  IF v_result<>'{}'::jsonb THEN RAISE EXCEPTION 'OAuth signup without metadata should use the IP guard: %',v_result; END IF;
END
$oauth_hook_allows_ip_limited_signup$;
RESET ROLE;
INSERT INTO auth.users(id,email,raw_user_meta_data)
VALUES('00000000-0000-4000-8000-000000000301','oauth-device@example.test','{}');

SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000301',false);
SET ROLE authenticated;
DO $oauth_install_claim$
BEGIN
  IF NOT public.claim_playora_installation('ffffffff-ffff-4fff-8fff-ffffffffffff') THEN
    RAISE EXCEPTION 'OAuth member should be able to bind the current install';
  END IF;
  IF NOT public.claim_playora_installation('ffffffff-ffff-4fff-8fff-ffffffffffff') THEN
    RAISE EXCEPTION 'Binding the same install to the same member must be idempotent';
  END IF;
END
$oauth_install_claim$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000302',false);
DO $oauth_duplicate_install_rejected$
DECLARE v_rejected boolean:=false;
BEGIN
  BEGIN
    PERFORM public.claim_playora_installation('ffffffff-ffff-4fff-8fff-ffffffffffff');
  EXCEPTION WHEN SQLSTATE '23505' THEN
    v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'A second member must not claim the same install'; END IF;
END
$oauth_duplicate_install_rejected$;
RESET ROLE;

DO $signup_guard_privileges$
BEGIN
  IF has_table_privilege('anon','private.signup_device_claims','SELECT')
     OR has_table_privilege('authenticated','private.signup_device_claims','SELECT')
     OR has_table_privilege('anon','private.signup_ip_attempts','SELECT')
     OR has_table_privilege('authenticated','private.signup_ip_attempts','SELECT') THEN
    RAISE EXCEPTION 'Browser roles must not read private signup fingerprints';
  END IF;
  IF has_function_privilege('anon','public.claim_playora_installation(text)','EXECUTE')
     OR has_function_privilege('anon','public.hook_playora_before_user_created(jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.hook_playora_before_user_created(jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Signup hook and device claim permissions are too broad';
  END IF;
  IF NOT has_function_privilege('authenticated','public.claim_playora_installation(text)','EXECUTE')
     OR NOT has_function_privilege('supabase_auth_admin','public.hook_playora_before_user_created(jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Auth and member device-claim entry points are not correctly granted';
  END IF;
END
$signup_guard_privileges$;

RESET ROLE;

\set ON_ERROR_STOP on
begin;

-- Disposable integration fixtures; every record is rolled back at the end of this test.
insert into auth.users(id,email,raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000301','support-one@example.test','{"display_name":"Support One","locale":"en"}'),
  ('00000000-0000-4000-8000-000000000302','support-two@example.test','{"display_name":"Support Two","locale":"fa"}')
on conflict (id) do nothing;

DO $support_privilege_contract$
BEGIN
  -- The migration intentionally grants column-level permissions, not table-wide SELECT/INSERT.
  IF NOT has_column_privilege('authenticated','public.support_reports','id','SELECT')
     OR NOT has_column_privilege('authenticated','public.support_reports','title','SELECT')
     OR NOT has_column_privilege('authenticated','public.support_reports','idempotency_key','INSERT')
     OR NOT has_column_privilege('authenticated','public.support_reports','diagnostics','INSERT') THEN
    RAISE EXCEPTION 'Authenticated members must be able to submit and read only approved support-report columns';
  END IF;
  IF has_table_privilege('anon','public.support_reports','SELECT')
     OR has_table_privilege('anon','public.support_reports','INSERT')
     OR has_table_privilege('authenticated','public.support_reports','UPDATE')
     OR has_table_privilege('authenticated','public.support_reports','DELETE') THEN
    RAISE EXCEPTION 'Anonymous access and client edits/deletes of support reports must be denied';
  END IF;
  IF has_column_privilege('authenticated','public.support_reports','user_id','INSERT')
     OR has_column_privilege('authenticated','public.support_reports','status','INSERT')
     OR has_column_privilege('authenticated','public.support_reports','created_at','INSERT')
     OR has_column_privilege('authenticated','public.support_reports','status','UPDATE') THEN
    RAISE EXCEPTION 'Clients must not choose ticket ownership, workflow status, or timestamps';
  END IF;
END
$support_privilege_contract$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000301',true);

INSERT INTO public.support_reports (
  idempotency_key, category, title, description, app_version, locale, route_key, diagnostics
) VALUES (
  '00000000-0000-4000-8000-000000000311',
  'bug','Catalog search issue','The catalog search does not preserve my current filter when I change pages.',
  '0.1.0','en','games',
  '{"appVersion":"0.1.0","locale":"en","route":"games","browserFamily":"Firefox","osFamily":"Linux"}'
);

DO $support_member_one$
DECLARE
  v_count integer;
  v_status text;
  v_owner uuid;
  v_duplicate_blocked boolean := false;
  v_secret_diagnostics_blocked boolean := false;
  v_forged_owner_blocked boolean := false;
BEGIN
  SELECT count(*) INTO v_count FROM public.support_reports;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Member One should see exactly one own report, got %',v_count;
  END IF;

  SELECT user_id,status INTO v_owner,v_status FROM public.support_reports;
  IF v_owner <> auth.uid() THEN RAISE EXCEPTION 'Support ticket owner was not derived from auth.uid()'; END IF;
  IF v_status <> 'open' THEN RAISE EXCEPTION 'New report status should default to open'; END IF;

  BEGIN
    INSERT INTO public.support_reports (
      idempotency_key,category,title,description,app_version,locale,route_key,diagnostics
    ) VALUES (
      '00000000-0000-4000-8000-000000000311',
      'bug','Duplicate report','The same submission should not create a duplicate ticket on retry.',
      '0.1.0','en','games',
      '{"appVersion":"0.1.0","locale":"en","route":"games","browserFamily":"Firefox","osFamily":"Linux"}'
    );
  EXCEPTION WHEN unique_violation THEN
    v_duplicate_blocked := true;
  END;
  IF NOT v_duplicate_blocked THEN
    RAISE EXCEPTION 'Idempotency key must prevent duplicate tickets for the same member';
  END IF;

  BEGIN
    INSERT INTO public.support_reports (
      idempotency_key,category,title,description,app_version,locale,route_key,diagnostics
    ) VALUES (
      '00000000-0000-4000-8000-000000000312',
      'bug','Unsafe diagnostics','Diagnostics must reject tokens and other sensitive values.',
      '0.1.0','en','games',
      '{"appVersion":"0.1.0","locale":"en","route":"games","browserFamily":"Firefox","osFamily":"Linux","authorization":"Bearer should-never-be-stored"}'
    );
  EXCEPTION WHEN check_violation THEN
    v_secret_diagnostics_blocked := true;
  END;
  IF NOT v_secret_diagnostics_blocked THEN
    RAISE EXCEPTION 'Unexpected diagnostics fields must be rejected';
  END IF;

  BEGIN
    INSERT INTO public.support_reports (
      id,user_id,idempotency_key,category,title,description,app_version,locale,route_key,diagnostics
    ) VALUES (
      gen_random_uuid(),'00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000313',
      'bug','Forged owner','A member must not assign a support ticket to another member.',
      '0.1.0','en','games',
      '{"appVersion":"0.1.0","locale":"en","route":"games","browserFamily":"Firefox","osFamily":"Linux"}'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_forged_owner_blocked := true;
  END;
  IF NOT v_forged_owner_blocked THEN
    RAISE EXCEPTION 'Clients must not choose the support ticket user_id';
  END IF;
END
$support_member_one$;

-- Five tickets per hour is the database-enforced member rate limit.
DO $support_rate_limit$
DECLARE
  i integer;
  v_limited boolean := false;
BEGIN
  FOR i IN 1..4 LOOP
    INSERT INTO public.support_reports (
      idempotency_key,category,title,description,app_version,locale,route_key,diagnostics
    ) VALUES (
      gen_random_uuid(),'bug','Rate test '||i,'This test report is inserted to verify the hourly support-report limit.',
      '0.1.0','en','games',
      '{"appVersion":"0.1.0","locale":"en","route":"games","browserFamily":"Firefox","osFamily":"Linux"}'
    );
  END LOOP;

  BEGIN
    INSERT INTO public.support_reports (
      idempotency_key,category,title,description,app_version,locale,route_key,diagnostics
    ) VALUES (
      gen_random_uuid(),'bug','Sixth report','This report must be blocked when the member has reached the hourly limit.',
      '0.1.0','en','games',
      '{"appVersion":"0.1.0","locale":"en","route":"games","browserFamily":"Firefox","osFamily":"Linux"}'
    );
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    v_limited := true;
  END;
  IF NOT v_limited THEN
    RAISE EXCEPTION 'Support report rate limit was not enforced by the database';
  END IF;
END
$support_rate_limit$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000302',true);
DO $support_member_two$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.support_reports;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Member Two can see another member support tickets'; END IF;

  INSERT INTO public.support_reports (
    idempotency_key, category, title, description, app_version, locale, route_key, diagnostics
  ) VALUES (
    '00000000-0000-4000-8000-000000000321',
    'account','Login help','I cannot complete the email verification flow on my account.',
    '0.1.0','fa','settings',
    '{"appVersion":"0.1.0","locale":"fa","route":"settings","browserFamily":"Other","osFamily":"Other"}'
  );
  SELECT count(*) INTO v_count FROM public.support_reports;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Member Two should see only the report they just submitted'; END IF;
END
$support_member_two$;

ROLLBACK;

-- Playora live migration reconciliation diagnostics
-- READ ONLY: run in the Supabase SQL Editor after selecting the Playora project.
-- This script does not create, alter, drop, repair, or update anything.

-- 1) Repeated migration labels and their distinct recorded versions.
select
  name,
  count(*) as recorded_rows,
  array_agg(version order by version) as recorded_versions
from supabase_migrations.schema_migrations
group by name
having count(*) > 1
order by name;

-- 2) Complete remote migration ledger (compare with supabase/migrations filenames).
select version, name
from supabase_migrations.schema_migrations
order by version;

-- 3) Release-critical objects expected by the current feature branch.
with expected(object_name, relation_name) as (
  values
    ('finance admin membership', 'public.platform_admin_members'),
    ('finance admin audit log', 'public.platform_admin_audit_events'),
    ('signup HMAC secret', 'private.signup_guard_secrets'),
    ('signup device claims', 'private.signup_device_claims'),
    ('signup IP attempts', 'private.signup_ip_attempts')
)
select object_name, relation_name, to_regclass(relation_name) is not null as exists
from expected
order by object_name;

-- 4) Release-critical RPCs and whether the new withdrawal-history gate is present.
select
  'public.hook_playora_before_user_created(jsonb)' as function_name,
  to_regprocedure('public.hook_playora_before_user_created(jsonb)') is not null as exists
union all
select
  'public.claim_playora_installation(text)',
  to_regprocedure('public.claim_playora_installation(text)') is not null
union all
select
  'public.request_withdrawal(bigint,uuid)',
  to_regprocedure('public.request_withdrawal(bigint,uuid)') is not null;

select
  case
    when to_regprocedure('public.request_withdrawal(bigint,uuid)') is null then 'missing'
    when position(
      'verified_deposit_history_below_minimum'
      in pg_get_functiondef(to_regprocedure('public.request_withdrawal(bigint,uuid)'))
    ) > 0 then '500-coin credited-deposit-history gate detected'
    else 'function exists, but the new credited-deposit-history gate was not detected'
  end as withdrawal_gate_status;

-- 5) Current activation and financial configuration counts.
select 'catalog games' as area, count(*) as total,
       count(*) filter (where is_enabled) as active
from public.catalog_games
union all
select 'plugin versions', count(*),
       count(*) filter (where state = 'enabled')
from public.game_plugin_versions
union all
select 'approved artifact origins', count(*),
       count(*) filter (where is_approved)
from public.game_plugin_artifact_origins
union all
select 'deposit networks', count(*),
       count(*) filter (where is_enabled)
from public.deposit_network_configs
union all
select 'withdrawal networks', count(*),
       count(*) filter (where is_enabled)
from public.withdrawal_network_configs
union all
select 'payout addresses', count(*),
       count(*) filter (where verification_status = 'verified')
from public.member_payout_addresses
union all
select 'deposit requests', count(*),
       count(*) filter (where status = 'credited')
from public.deposit_requests
union all
select 'withdrawal requests', count(*),
       count(*) filter (where status = 'paid')
from public.withdrawal_requests;

-- 6) Public SECURITY DEFINER RPCs callable by authenticated users.
-- Review each function's auth.uid(), tenant/member checks, search_path and grants.
-- Do not revoke or change functions solely because they appear in this list.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and (
    has_function_privilege('anon', p.oid, 'EXECUTE')
    or has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )
order by p.proname, arguments;

-- 7) Public tables exposed to anon/authenticated through table privileges.
-- This is a privilege inventory, not a substitute for reviewing RLS policies.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
  has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_insert,
  has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_update,
  has_table_privilege('authenticated', c.oid, 'DELETE') as authenticated_delete
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

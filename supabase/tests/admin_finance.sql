\set ON_ERROR_STOP on

-- This test runs after the finance admin control-plane migration.
DO $admin_finance_invariants$
DECLARE
  v_admin_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='platform_admin_members' AND c.relrowsecurity=true
  ) THEN RAISE EXCEPTION 'Admin membership table must have RLS enabled'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='platform_admin_audit_events' AND c.relrowsecurity=true
  ) THEN RAISE EXCEPTION 'Admin audit table must have RLS enabled'; END IF;

  IF has_table_privilege('authenticated','public.platform_admin_members','SELECT')
     OR has_table_privilege('authenticated','public.platform_admin_members','INSERT')
     OR has_table_privilege('authenticated','public.platform_admin_members','UPDATE')
     OR has_table_privilege('authenticated','public.platform_admin_members','DELETE') THEN
    RAISE EXCEPTION 'Authenticated members must never access admin identities';
  END IF;

  IF has_table_privilege('authenticated','public.platform_admin_audit_events','SELECT')
     OR has_table_privilege('authenticated','public.platform_admin_audit_events','INSERT')
     OR has_table_privilege('authenticated','public.platform_admin_audit_events','UPDATE')
     OR has_table_privilege('authenticated','public.platform_admin_audit_events','DELETE') THEN
    RAISE EXCEPTION 'Authenticated members must never access admin audit events';
  END IF;

  IF NOT has_table_privilege('service_role','public.platform_admin_members','SELECT')
     OR NOT has_table_privilege('service_role','public.platform_admin_members','INSERT')
     OR NOT has_table_privilege('service_role','public.platform_admin_members','UPDATE')
     OR NOT has_table_privilege('service_role','public.platform_admin_audit_events','INSERT') THEN
    RAISE EXCEPTION 'Service role must have the required admin control-plane privileges';
  END IF;

  SELECT count(*) INTO v_admin_count FROM public.platform_admin_members;
  IF v_admin_count<>0 THEN
    RAISE EXCEPTION 'No administrator may be seeded without explicit owner identity confirmation; rows %',v_admin_count;
  END IF;
END
$admin_finance_invariants$;

RESET ROLE;

\set ON_ERROR_STOP on
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.platform_admin_members'::regclass) THEN
    RAISE EXCEPTION 'platform_admin_members must have RLS enabled';
  END IF;
  IF has_table_privilege('anon','public.platform_admin_members','SELECT')
     OR has_table_privilege('authenticated','public.platform_admin_members','SELECT')
     OR has_table_privilege('authenticated','public.platform_admin_members','INSERT')
     OR has_table_privilege('authenticated','public.platform_admin_members','UPDATE')
     OR has_table_privilege('authenticated','public.platform_admin_members','DELETE') THEN
    RAISE EXCEPTION 'Client roles must not read or mutate privileged admin membership';
  END IF;
  IF has_table_privilege('anon','public.platform_admin_audit_events','SELECT')
     OR has_table_privilege('authenticated','public.platform_admin_audit_events','SELECT')
     OR has_table_privilege('authenticated','public.platform_admin_audit_events','INSERT')
     OR has_table_privilege('authenticated','public.platform_admin_audit_events','UPDATE')
     OR has_table_privilege('authenticated','public.platform_admin_audit_events','DELETE') THEN
    RAISE EXCEPTION 'Client roles must not access privileged audit log';
  END IF;
  IF NOT has_table_privilege('service_role','public.platform_admin_members','SELECT')
     OR NOT has_table_privilege('service_role','public.platform_admin_members','INSERT')
     OR NOT has_table_privilege('service_role','public.platform_admin_members','UPDATE')
     OR NOT has_table_privilege('service_role','public.platform_admin_audit_events','INSERT') THEN
    RAISE EXCEPTION 'service_role grants for private finance administration are incomplete';
  END IF;
END $$;

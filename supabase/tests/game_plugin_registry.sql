\set ON_ERROR_STOP on

DO $plugin_registry_initial_state$
BEGIN
  IF EXISTS (SELECT 1 FROM public.catalog_games WHERE is_enabled = true) THEN
    RAISE EXCEPTION 'No game may be enabled during platform-only development';
  END IF;
  IF (SELECT count(*) FROM public.game_plugin_artifact_origins) <> 0 THEN
    RAISE EXCEPTION 'Trusted artifact origins must be explicitly approved; none is seeded by migration';
  END IF;
  IF (SELECT count(*) FROM public.game_plugin_versions WHERE state = 'enabled') <> 0 THEN
    RAISE EXCEPTION 'No plugin version may be enabled before the platform release gate';
  END IF;
  IF has_table_privilege('anon','public.game_plugin_artifact_origins','SELECT')
     OR has_table_privilege('authenticated','public.game_plugin_artifact_origins','SELECT')
     OR has_table_privilege('anon','public.game_plugin_artifact_origins','INSERT') THEN
    RAISE EXCEPTION 'Browser roles must not inspect or modify approved artifact origins';
  END IF;
  IF NOT has_column_privilege('anon','public.game_plugin_versions','granted_capabilities','SELECT')
     OR has_column_privilege('authenticated','public.game_plugin_versions','granted_capabilities','UPDATE') THEN
    RAISE EXCEPTION 'Explicit plugin grants must be readable but not editable by browser roles';
  END IF;
  IF has_table_privilege('anon','public.game_plugin_versions','INSERT')
     OR has_table_privilege('authenticated','public.game_plugin_versions','UPDATE')
     OR has_table_privilege('authenticated','public.game_plugin_versions','DELETE') THEN
    RAISE EXCEPTION 'Browser roles must not modify the trusted plugin registry';
  END IF;
  IF NOT has_column_privilege('anon','public.game_plugin_versions','granted_capabilities','SELECT')
     OR has_column_privilege('authenticated','public.game_plugin_versions','granted_capabilities','UPDATE') THEN
    RAISE EXCEPTION 'Explicit plugin grants must be readable but not editable by browser roles';
  END IF;
  IF NOT has_column_privilege('anon','public.game_plugin_versions','entrypoint_url','SELECT')
     OR NOT has_column_privilege('authenticated','public.game_plugin_versions','manifest','SELECT') THEN
    RAISE EXCEPTION 'Public descriptors must be readable when RLS permits';
  END IF;
  IF has_column_privilege('anon','public.game_plugin_versions','created_by','SELECT')
     OR has_column_privilege('authenticated','public.game_plugin_versions','reviewed_by','SELECT') THEN
    RAISE EXCEPTION 'Internal registry actors must not be exposed to browsers';
  END IF;
  IF NOT has_table_privilege('service_role','public.game_plugin_versions','UPDATE')
     OR NOT has_table_privilege('service_role','public.game_plugin_versions','INSERT') THEN
    RAISE EXCEPTION 'Trusted server role must manage plugin publication';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='game_plugin_versions_one_enabled_per_game_idx') THEN
    RAISE EXCEPTION 'Registry must prevent multiple enabled versions per game';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='game_plugin_artifact_origins_created_by_idx') THEN
    RAISE EXCEPTION 'Artifact-origin creator reference must be indexed';
  END IF;
END
$plugin_registry_initial_state$;

BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data)
VALUES ('00000000-0000-4000-8000-000000000099','registry-reviewer@example.test','{"display_name":"Registry Reviewer","locale":"en"}')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.game_plugin_artifact_origins(origin,is_approved)
VALUES ('https://games.playora.example',false);
UPDATE public.game_plugin_artifact_origins
SET is_approved=true, approved_by='00000000-0000-4000-8000-000000000099', approved_at=now()
WHERE origin='https://games.playora.example';

DO $plugin_registry_lifecycle$
DECLARE
  v_id uuid;
  v_valid_manifest jsonb := jsonb_build_object(
    'manifestVersion',1,'id','chess','version','99.0.0',
    'title',jsonb_build_object('en','Chess','fa','شطرنج'),
    'description',jsonb_build_object('en','Classic strategy','fa','استراتژی کلاسیک'),
    'category','board',
    'playerRange',jsonb_build_object('min',2,'max',2),
    'sdkCompatibility',jsonb_build_object('min','1.0.0','maxExclusive','2.0.0'),
    'artifact',jsonb_build_object(
      'entrypointUrl','https://games.playora.example/chess/99.0.0/index.html',
      'sha256',repeat('a',64)
    ),
    'capabilities',jsonb_build_array('locale:read')
  );
  v_bad_manifest jsonb;
  v_origin_blocked boolean := false;
  v_capability_blocked boolean := false;
  v_direct_enable_blocked boolean := false;
  v_immutable_blocked boolean := false;
BEGIN
  v_bad_manifest := jsonb_set(v_valid_manifest,'{version}','"98.0.0"'::jsonb);
  v_bad_manifest := jsonb_set(v_bad_manifest,'{artifact,entrypointUrl}','"https://evil.example/chess/98.0.0/index.html"'::jsonb);
  BEGIN
    INSERT INTO public.game_plugin_versions(game_id,version,manifest,sdk_min_version,sdk_max_exclusive,entrypoint_url,artifact_sha256,requested_capabilities,state)
    VALUES ('chess','98.0.0',v_bad_manifest,'1.0.0','2.0.0','https://evil.example/chess/98.0.0/index.html',repeat('a',64),array['locale:read']::text[],'draft');
  EXCEPTION WHEN check_violation THEN v_origin_blocked := true;
  END;
  IF NOT v_origin_blocked THEN RAISE EXCEPTION 'Unapproved artifact origin must be rejected'; END IF;

  v_bad_manifest := jsonb_set(v_valid_manifest,'{version}','"100.0.0"'::jsonb);
  v_bad_manifest := jsonb_set(v_bad_manifest,'{artifact,entrypointUrl}','"https://games.playora.example/chess/100.0.0/index.html"'::jsonb);
  v_bad_manifest := jsonb_set(v_bad_manifest,'{capabilities}','["wallet:write"]'::jsonb);
  BEGIN
    INSERT INTO public.game_plugin_versions(game_id,version,manifest,sdk_min_version,sdk_max_exclusive,entrypoint_url,artifact_sha256,requested_capabilities,state)
    VALUES ('chess','100.0.0',v_bad_manifest,'1.0.0','2.0.0','https://games.playora.example/chess/100.0.0/index.html',repeat('a',64),array['wallet:write']::text[],'draft');
  EXCEPTION WHEN check_violation THEN v_capability_blocked := true;
  END;
  IF NOT v_capability_blocked THEN RAISE EXCEPTION 'Unknown requested capabilities must be rejected'; END IF;

  INSERT INTO public.game_plugin_versions(game_id,version,manifest,sdk_min_version,sdk_max_exclusive,entrypoint_url,artifact_sha256,requested_capabilities,granted_capabilities,state,created_by)
  VALUES ('chess','99.0.0',v_valid_manifest,'1.0.0','2.0.0','https://games.playora.example/chess/99.0.0/index.html',repeat('a',64),array['locale:read']::text[],array['locale:read']::text[],'draft','00000000-0000-4000-8000-000000000099')
  RETURNING id INTO v_id;

  BEGIN
    UPDATE public.game_plugin_versions SET state='enabled',enabled_at=now() WHERE id=v_id;
  EXCEPTION WHEN check_violation THEN v_direct_enable_blocked := true;
  END;
  IF NOT v_direct_enable_blocked THEN RAISE EXCEPTION 'Draft plugin must not bypass review'; END IF;

  UPDATE public.game_plugin_versions SET state='review' WHERE id=v_id;
  UPDATE public.game_plugin_versions SET state='approved',reviewed_by='00000000-0000-4000-8000-000000000099',reviewed_at=now() WHERE id=v_id;
  UPDATE public.game_plugin_versions SET state='enabled',enabled_at=now() WHERE id=v_id;

  BEGIN
    UPDATE public.game_plugin_versions SET artifact_sha256=repeat('b',64) WHERE id=v_id;
  EXCEPTION WHEN check_violation THEN v_immutable_blocked := true;
  END;
  IF NOT v_immutable_blocked THEN RAISE EXCEPTION 'Artifact digest must be immutable'; END IF;

  BEGIN
    UPDATE public.game_plugin_versions SET granted_capabilities=array[]::text[] WHERE id=v_id;
    RAISE EXCEPTION 'Capability grants must be immutable after approval';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END
$plugin_registry_lifecycle$;

SET LOCAL ROLE anon;
DO $public_catalog$
BEGIN
  IF (SELECT count(*) FROM public.catalog_games WHERE catalog_visible=true) < 8 THEN
    RAISE EXCEPTION 'Catalog metadata baseline expected at least eight visible games';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_plugin_versions WHERE game_id='chess') THEN
    RAISE EXCEPTION 'A plugin must not be visible while its catalog game is disabled';
  END IF;
END
$public_catalog$;
RESET ROLE;

UPDATE public.game_plugin_artifact_origins SET is_approved=false WHERE origin='https://games.playora.example';
DO $origin_revocation$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.game_plugin_versions WHERE game_id='chess' AND version='99.0.0' AND state='revoked') THEN
    RAISE EXCEPTION 'Origin revocation must revoke all affected plugin versions';
  END IF;
END
$origin_revocation$;

ROLLBACK;

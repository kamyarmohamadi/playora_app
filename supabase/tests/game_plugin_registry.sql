\set ON_ERROR_STOP on

DO $plugin_registry_invariants$
DECLARE
  v_id uuid;
  v_immutable_blocked boolean := false;
  v_invalid_range_blocked boolean := false;
BEGIN
  IF NOT has_table_privilege('anon','public.catalog_games','SELECT')
     OR NOT has_table_privilege('authenticated','public.catalog_games','SELECT') THEN
    RAISE EXCEPTION 'Visible catalog metadata must be readable to guests and members';
  END IF;
  IF has_table_privilege('anon','public.catalog_games','INSERT')
     OR has_table_privilege('authenticated','public.catalog_games','UPDATE')
     OR has_table_privilege('authenticated','public.catalog_games','DELETE') THEN
    RAISE EXCEPTION 'Browser roles must not write catalog metadata';
  END IF;
  IF EXISTS (SELECT 1 FROM public.catalog_games WHERE is_enabled = true) THEN
    RAISE EXCEPTION 'No game may be enabled during platform-only development';
  END IF;
  IF (SELECT count(*) FROM public.catalog_games WHERE catalog_visible = true) <> 8 THEN
    RAISE EXCEPTION 'All eight planned game labels should remain visible as non-playable metadata';
  END IF;

  IF has_table_privilege('anon','public.game_plugin_versions','INSERT')
     OR has_table_privilege('authenticated','public.game_plugin_versions','UPDATE')
     OR has_table_privilege('authenticated','public.game_plugin_versions','DELETE') THEN
    RAISE EXCEPTION 'Browser roles must not modify the trusted plugin registry';
  END IF;
  IF NOT has_column_privilege('anon','public.game_plugin_versions','entrypoint_url','SELECT')
     OR NOT has_column_privilege('authenticated','public.game_plugin_versions','manifest','SELECT') THEN
    RAISE EXCEPTION 'Public plugin descriptors must be readable when RLS permits';
  END IF;
  IF has_column_privilege('anon','public.game_plugin_versions','created_by','SELECT')
     OR has_column_privilege('authenticated','public.game_plugin_versions','reviewed_by','SELECT') THEN
    RAISE EXCEPTION 'Internal registry actors must not be exposed to browser roles';
  END IF;
  IF NOT has_table_privilege('service_role','public.game_plugin_versions','UPDATE')
     OR NOT has_table_privilege('service_role','public.game_plugin_versions','INSERT') THEN
    RAISE EXCEPTION 'Trusted server role must manage plugin publication state';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_plugin_versions WHERE state = 'enabled') THEN
    RAISE EXCEPTION 'No game plugin version may be enabled before the platform release gate';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'game_plugin_versions_one_enabled_per_game_idx'
  ) THEN
    RAISE EXCEPTION 'Registry must prevent multiple enabled versions for a game';
  END IF;

  BEGIN
    INSERT INTO public.game_plugin_versions(
      game_id, version, manifest, sdk_min_version, sdk_max_exclusive,
      entrypoint_url, artifact_sha256, state
    ) VALUES (
      'chess', '98.0.0',
      '{"manifestVersion":1,"id":"chess","version":"98.0.0"}'::jsonb,
      '2.0.0', '1.0.0',
      'https://games.playora.example/chess/98.0.0/index.html',
      repeat('c',64), 'draft'
    );
  EXCEPTION WHEN check_violation THEN
    v_invalid_range_blocked := true;
  END;
  IF NOT v_invalid_range_blocked THEN
    RAISE EXCEPTION 'Plugin registry must reject descending SDK compatibility ranges';
  END IF;

  INSERT INTO public.game_plugin_versions(
    game_id, version, manifest, sdk_min_version, sdk_max_exclusive,
    entrypoint_url, artifact_sha256, state
  ) VALUES (
    'chess', '99.0.0',
    '{"manifestVersion":1,"id":"chess","version":"99.0.0"}'::jsonb,
    '1.0.0', '2.0.0',
    'https://games.playora.example/chess/99.0.0/index.html',
    repeat('a',64), 'draft'
  ) RETURNING id INTO v_id;

  BEGIN
    UPDATE public.game_plugin_versions
      SET artifact_sha256 = repeat('b',64)
      WHERE id = v_id;
  EXCEPTION WHEN check_violation THEN
    v_immutable_blocked := true;
  END;
  IF NOT v_immutable_blocked THEN
    RAISE EXCEPTION 'Artifact identifier and digest must be immutable';
  END IF;
  DELETE FROM public.game_plugin_versions WHERE id = v_id;
END
$plugin_registry_invariants$;

BEGIN;
SET LOCAL ROLE anon;
DO $public_catalog$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.catalog_games WHERE catalog_visible = true;
  IF v_count <> 8 THEN
    RAISE EXCEPTION 'Anonymous catalog query expected eight visible metadata rows, got %', v_count;
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_plugin_versions) THEN
    RAISE EXCEPTION 'No disabled/unapproved plugin may be visible or launchable to guests';
  END IF;
END
$public_catalog$;
ROLLBACK;

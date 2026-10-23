\set ON_ERROR_STOP on
-- Assert that capacity indexes exist on the intended table, with the expected
-- key columns/partial predicate, and are valid and ready for query planning.
DO $$
DECLARE
  index_name text;
  expected_table text;
  expected_keys text;
  expected_partial boolean;
BEGIN
  FOREACH index_name IN ARRAY ARRAY[
    'friend_requests_sender_status_created_idx',
    'private_rooms_host_open_expiry_idx',
    'private_rooms_open_expiry_idx'
  ]
  LOOP
    expected_table := CASE
      WHEN index_name = 'friend_requests_sender_status_created_idx' THEN 'friend_requests'
      ELSE 'private_rooms'
    END;
    expected_keys := CASE
      WHEN index_name = 'friend_requests_sender_status_created_idx' THEN 'sender_id, status, created_at DESC'
      WHEN index_name = 'private_rooms_host_open_expiry_idx' THEN 'host_user_id, expires_at'
      ELSE 'expires_at'
    END;
    expected_partial := index_name <> 'friend_requests_sender_status_created_idx';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class idx
      JOIN pg_catalog.pg_namespace idx_schema ON idx_schema.oid = idx.relnamespace
      JOIN pg_catalog.pg_index i ON i.indexrelid = idx.oid
      JOIN pg_catalog.pg_class tbl ON tbl.oid = i.indrelid
      JOIN pg_catalog.pg_namespace tbl_schema ON tbl_schema.oid = tbl.relnamespace
      WHERE idx_schema.nspname = 'public'
        AND tbl_schema.nspname = 'public'
        AND idx.relname = index_name
        AND tbl.relname = expected_table
        AND i.indisvalid
        AND i.indisready
        AND (i.indpred IS NOT NULL) = expected_partial
        AND pg_catalog.position(expected_keys IN pg_catalog.pg_get_indexdef(idx.oid)) > 0
    ) THEN
      RAISE EXCEPTION
        'Capacity index is missing, invalid, attached to the wrong table, or has unexpected keys/predicate: %',
        index_name;
    END IF;
  END LOOP;
END
$$;

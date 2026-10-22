\set ON_ERROR_STOP on
-- Assert the capacity-oriented migration creates valid indexes for hot query paths.
DO $$
DECLARE
  index_name text;
BEGIN
  FOREACH index_name IN ARRAY ARRAY[
    'friend_requests_sender_status_created_idx',
    'private_rooms_host_open_expiry_idx',
    'private_rooms_open_expiry_idx'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_catalog.pg_index i ON i.indexrelid = c.oid
      WHERE n.nspname = 'public'
        AND c.relname = index_name
        AND i.indisvalid
        AND i.indisready
    ) THEN
      RAISE EXCEPTION 'Expected valid and ready capacity index is missing: %', index_name;
    END IF;
  END LOOP;
END
$$;

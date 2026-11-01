\set ON_ERROR_STOP on
DO $$
DECLARE missing text[];
BEGIN
 SELECT array_agg(x.name ORDER BY x.name) INTO missing
 FROM (VALUES
 ('deposit_network_configs_updated_by_idx'),
 ('deposit_requests_credited_ledger_id_idx'),
 ('deposit_requests_duplicate_of_request_id_idx'),
 ('deposit_requests_reviewed_by_idx'),
 ('deposit_tx_duplicate_attempts_attempted_by_idx'),
 ('deposit_tx_duplicate_attempts_first_request_id_idx'),
 ('deposit_tx_first_claims_first_request_id_idx'),
 ('deposit_tx_first_claims_first_user_id_idx'),
 ('member_gate_verifications_updated_by_idx'),
 ('member_payout_addresses_reviewed_by_idx'),
 ('paid_coin_lot_consumptions_lot_id_idx'),
 ('paid_coin_lot_consumptions_user_id_idx'),
 ('withdrawal_network_configs_updated_by_idx'),
 ('withdrawal_requests_reserve_ledger_id_idx')
 ) x(name)
 WHERE NOT EXISTS (
  SELECT 1 FROM pg_class i JOIN pg_index pi ON pi.indexrelid=i.oid
  JOIN pg_namespace n ON n.oid=i.relnamespace
  WHERE n.nspname='public' AND i.relname=x.name AND pi.indisvalid AND pi.indisready
 );
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing finance indexes: %',missing; END IF;
 IF EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='deposit_requests' AND indexname='deposit_requests_user_idx') THEN
   RAISE EXCEPTION 'Duplicate deposit_requests_user_idx still exists';
 END IF;
END $$;

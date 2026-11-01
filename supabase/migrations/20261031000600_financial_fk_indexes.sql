-- Cover finance foreign keys and remove a redundant member-history index.
begin;
create index if not exists deposit_network_configs_updated_by_idx on public.deposit_network_configs(updated_by);
create index if not exists deposit_requests_credited_ledger_id_idx on public.deposit_requests(credited_ledger_id);
create index if not exists deposit_requests_duplicate_of_request_id_idx on public.deposit_requests(duplicate_of_request_id);
create index if not exists deposit_requests_reviewed_by_idx on public.deposit_requests(reviewed_by);
create index if not exists deposit_tx_duplicate_attempts_attempted_by_idx on public.deposit_tx_duplicate_attempts(attempted_by);
create index if not exists deposit_tx_duplicate_attempts_first_request_id_idx on public.deposit_tx_duplicate_attempts(first_request_id);
create index if not exists deposit_tx_first_claims_first_request_id_idx on public.deposit_tx_first_claims(first_request_id);
create index if not exists deposit_tx_first_claims_first_user_id_idx on public.deposit_tx_first_claims(first_user_id);
create index if not exists member_gate_verifications_updated_by_idx on public.member_gate_verifications(updated_by);
create index if not exists member_payout_addresses_reviewed_by_idx on public.member_payout_addresses(reviewed_by);
create index if not exists paid_coin_lot_consumptions_lot_id_idx on public.paid_coin_lot_consumptions(lot_id);
create index if not exists paid_coin_lot_consumptions_user_id_idx on public.paid_coin_lot_consumptions(user_id);
create index if not exists withdrawal_network_configs_updated_by_idx on public.withdrawal_network_configs(updated_by);
create index if not exists withdrawal_requests_reserve_ledger_id_idx on public.withdrawal_requests(reserve_ledger_id);
drop index if exists public.deposit_requests_user_idx;
commit;

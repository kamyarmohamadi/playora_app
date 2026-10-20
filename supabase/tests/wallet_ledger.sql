\set ON_ERROR_STOP on

INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-000000000003','wallet-test@example.test','{"display_name":"Wallet Test","locale":"en"}')
ON CONFLICT (id) DO NOTHING;

-- Execute the SECURITY DEFINER procedure as the trusted server identity.
-- The bootstrap auth.role() shim reads this request claim exactly as Supabase does.
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);

DO $wallet_ledger$
DECLARE
  v_wallet public.coin_wallets;
  v_before bigint;
  v_after bigint;
  v_ledger_rows integer;
  v_replay_rejected boolean := false;
  v_overdraft_rejected boolean := false;
  v_unauthorized_rejected boolean := false;
BEGIN
  SELECT purchased_coins INTO v_before
  FROM public.coin_wallets
  WHERE user_id='00000000-0000-4000-8000-000000000003';
  IF v_before <> 0 THEN RAISE EXCEPTION 'Wallet test must start with zero purchased coins'; END IF;

  v_wallet := public.apply_coin_delta(
    '00000000-0000-4000-8000-000000000003'::uuid,
    'purchased',100,'purchase',
    'wallet-test-purchase-0003','ci-wallet-test'
  );
  IF v_wallet.purchased_coins <> 100 THEN
    RAISE EXCEPTION 'First purchase must add exactly 100 coins; got %',v_wallet.purchased_coins;
  END IF;

  -- Exact replay with the same idempotency key must return current balance, not apply again.
  v_wallet := public.apply_coin_delta(
    '00000000-0000-4000-8000-000000000003'::uuid,
    'purchased',100,'purchase',
    'wallet-test-purchase-0003','ci-wallet-test'
  );
  IF v_wallet.purchased_coins <> 100 THEN
    RAISE EXCEPTION 'Idempotent purchase replay double-credited wallet: %',v_wallet.purchased_coins;
  END IF;

  SELECT count(*) INTO v_ledger_rows FROM public.coin_ledger
  WHERE user_id='00000000-0000-4000-8000-000000000003'
    AND idempotency_key='wallet-test-purchase-0003';
  IF v_ledger_rows <> 1 THEN
    RAISE EXCEPTION 'Idempotent purchase must create one ledger row, got %',v_ledger_rows;
  END IF;

  -- Reusing a key for different economic facts must be rejected.
  BEGIN
    PERFORM public.apply_coin_delta(
      '00000000-0000-4000-8000-000000000003'::uuid,
      'purchased',101,'purchase',
      'wallet-test-purchase-0003','ci-wallet-test'
    );
    v_replay_rejected := false;
  EXCEPTION WHEN unique_violation THEN
    v_replay_rejected := true;
  END;
  IF NOT v_replay_rejected THEN
    RAISE EXCEPTION 'Idempotency key conflict was accepted';
  END IF;

  -- A debit larger than the available bucket must roll back fully.
  BEGIN
    PERFORM public.apply_coin_delta(
      '00000000-0000-4000-8000-000000000003'::uuid,
      'purchased',-101,'match_entry',
      'wallet-test-overdraft-0003','ci-wallet-test'
    );
    v_overdraft_rejected := false;
  EXCEPTION WHEN check_violation THEN
    v_overdraft_rejected := true;
  END;
  IF NOT v_overdraft_rejected THEN
    RAISE EXCEPTION 'Overdraft was accepted';
  END IF;

  SELECT purchased_coins INTO v_after
  FROM public.coin_wallets
  WHERE user_id='00000000-0000-4000-8000-000000000003';
  IF v_after <> 100 THEN RAISE EXCEPTION 'Rejected overdraft changed wallet balance to %',v_after; END IF;

  v_wallet := public.apply_coin_delta(
    '00000000-0000-4000-8000-000000000003'::uuid,
    'purchased',-40,'match_entry',
    'wallet-test-entry-0003','ci-wallet-test'
  );
  IF v_wallet.purchased_coins <> 60 THEN
    RAISE EXCEPTION 'Valid debit must reduce balance to 60, got %',v_wallet.purchased_coins;
  END IF;

  -- Procedure's own authorization guard must reject non-service roles even if it is called internally.
  PERFORM set_config('request.jwt.claim.role','authenticated',false);
  BEGIN
    PERFORM public.apply_coin_delta(
      '00000000-0000-4000-8000-000000000003'::uuid,
      'purchased',1,'purchase',
      'wallet-test-unauthorized-0003','ci-wallet-test'
    );
    v_unauthorized_rejected := false;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_unauthorized_rejected := true;
  END;
  IF NOT v_unauthorized_rejected THEN
    RAISE EXCEPTION 'Wallet mutation function did not reject authenticated-client role';
  END IF;

  PERFORM set_config('request.jwt.claim.role','service_role',false);
  SELECT purchased_coins INTO v_after
  FROM public.coin_wallets
  WHERE user_id='00000000-0000-4000-8000-000000000003';
  IF v_after <> 60 THEN
    RAISE EXCEPTION 'Unauthorized wallet call changed balance to %',v_after;
  END IF;

  SELECT count(*) INTO v_ledger_rows FROM public.coin_ledger
  WHERE user_id='00000000-0000-4000-8000-000000000003'
    AND idempotency_key='wallet-test-unauthorized-0003';
  IF v_ledger_rows <> 0 THEN
    RAISE EXCEPTION 'Unauthorized wallet call created a ledger row';
  END IF;
END
$wallet_ledger$;

RESET ROLE;

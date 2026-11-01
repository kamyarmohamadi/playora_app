\set ON_ERROR_STOP on

-- User 10 is created by economy_tracks.sql; user 11 is a second claimant.
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('00000000-0000-4000-8000-000000000011','finance-duplicate@example.test','{"display_name":"Duplicate Claim","locale":"en"}'),
 ('00000000-0000-4000-8000-000000000012','finance-daily-cap@example.test','{"display_name":"Daily Cap","locale":"en"}')
ON CONFLICT(id) DO NOTHING;

CREATE TEMP TABLE finance_test_ids(name text primary key,id uuid not null);
GRANT INSERT,SELECT ON finance_test_ids TO authenticated;

INSERT INTO public.deposit_network_configs(
  asset_code,network_code,deposit_address,usd_per_asset,coins_per_usd,min_amount,is_enabled
)
VALUES
 ('USDT','TRC20','T_TEST_DEPOSIT_ADDRESS_123456789',1.0,100,0.1,true),
 ('USDC','TRC20','T_TEST_DEPOSIT_ADDRESS_123456789',1.0,100,0.1,true)
ON CONFLICT(asset_code,network_code) DO UPDATE
SET deposit_address=excluded.deposit_address,usd_per_asset=excluded.usd_per_asset,
    coins_per_usd=excluded.coins_per_usd,min_amount=excluded.min_amount,is_enabled=true;

INSERT INTO public.withdrawal_network_configs(
  asset_code,network_code,usd_per_asset,network_fee_asset,is_enabled
)
VALUES('USDT','TRC20',1.0,0.1,true)
ON CONFLICT(asset_code,network_code) DO UPDATE
SET usd_per_asset=excluded.usd_per_asset,network_fee_asset=excluded.network_fee_asset,is_enabled=true;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000010',false);

DO $first_deposit_claim$
DECLARE
  v_request uuid;
  v_coin_amount bigint;
  v_options integer;
BEGIN
  SELECT count(*) INTO v_options FROM public.get_deposit_options();
  IF v_options<1 THEN RAISE EXCEPTION 'Enabled deposit network was not returned'; END IF;

  v_request := public.submit_deposit_claim(
    'USDC','TRC20',4.5,
    '0x1111111111111111111111111111111111111111111111111111111111111111',
    now()-interval '1 minute'
  );
  INSERT INTO finance_test_ids(name,id) VALUES('first_deposit',v_request);

  SELECT coin_amount INTO v_coin_amount FROM public.deposit_requests WHERE id=v_request;
  IF v_coin_amount<>450 THEN
    RAISE EXCEPTION '4.5 USD deposit must quote 450 coins, got %',v_coin_amount;
  END IF;
  IF (SELECT status FROM public.deposit_requests WHERE id=v_request)<>'under_review' THEN
    RAISE EXCEPTION 'First transaction claimant must enter manual review';
  END IF;
END
$first_deposit_claim$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',false);
DO $duplicate_deposit_claim$
DECLARE
  v_request uuid;
  v_status text;
BEGIN
  v_request := public.submit_deposit_claim(
    'USDT','TRC20',4.5,
    '0x1111111111111111111111111111111111111111111111111111111111111111',
    now()-interval '1 minute'
  );
  INSERT INTO finance_test_ids(name,id) VALUES('duplicate_deposit',v_request);
  SELECT status INTO v_status FROM public.deposit_requests WHERE id=v_request;
  IF v_status<>'duplicate' THEN
    RAISE EXCEPTION 'Second claimant must be recorded as duplicate, got %',v_status;
  END IF;
END
$duplicate_deposit_claim$;

RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000010',false);

DO $approve_first_deposit$
DECLARE
  v_id uuid;
  v_wallet bigint;
  v_status text;
BEGIN
  SELECT id INTO v_id FROM finance_test_ids WHERE name='first_deposit';
  PERFORM public.review_deposit_request(v_id,true,'CI manual approval');
  SELECT purchased_coins INTO v_wallet FROM public.coin_wallets WHERE user_id='00000000-0000-4000-8000-000000000010';
  SELECT status INTO v_status FROM public.deposit_requests WHERE id=v_id;
  IF v_status<>'credited' OR v_wallet<>500 THEN
    RAISE EXCEPTION 'Approved deposit should credit 450 Value coins on top of 50 gift; status %, balance %',v_status,v_wallet;
  END IF;
  IF (SELECT count(*) FROM public.paid_coin_lots
      WHERE user_id='00000000-0000-4000-8000-000000000010'
        AND source_type='deposit' AND original_coins=450 AND turnover_required=90)<>1 THEN
    RAISE EXCEPTION 'Deposit credit must create a 450-coin lot with 90 turnover requirement';
  END IF;
  IF (SELECT count(*) FROM public.deposit_tx_duplicate_attempts
      WHERE duplicate_request_id=(SELECT id FROM finance_test_ids WHERE name='duplicate_deposit'))<>1 THEN
    RAISE EXCEPTION 'Duplicate transaction attempt must be retained for audit';
  END IF;
  IF (SELECT purchased_coins FROM public.coin_wallets WHERE user_id='00000000-0000-4000-8000-000000000011')<>50 THEN
    RAISE EXCEPTION 'Duplicate claimant must not receive a duplicate credit';
  END IF;
END
$approve_first_deposit$;

-- Three completed Paid matches prove the 50-coin signup gift does not count
-- toward deposit turnover, while 90 coins funded by the deposit do count.
INSERT INTO public.matches(id,game_id,mode,economy_mode,status,entry_coins)
VALUES
 ('00000000-0000-4000-8000-000000000101','chess','ranked','paid','active',50),
 ('00000000-0000-4000-8000-000000000102','chess','ranked','paid','active',50),
 ('00000000-0000-4000-8000-000000000103','chess','ranked','paid','active',40);
INSERT INTO public.match_participants(match_id,user_id,seat,final_result)
VALUES
 ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000010',1,'win'),
 ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000011',2,'loss'),
 ('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000010',1,'loss'),
 ('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000011',2,'win'),
 ('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000010',1,'win'),
 ('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000011',2,'loss');

DO $deposit_turnover$
DECLARE
  v_counted bigint;
  v_required bigint;
  v_completed bigint;
BEGIN
  PERFORM public.apply_coin_delta(
    '00000000-0000-4000-8000-000000000010','purchased',-50,'match_entry',
    'finance-match-entry-101','00000000-0000-4000-8000-000000000101'
  );
  UPDATE public.matches SET status='completed' WHERE id='00000000-0000-4000-8000-000000000101';
  v_counted := public.complete_paid_match_turnover('00000000-0000-4000-8000-000000000101');
  IF v_counted<>0 THEN RAISE EXCEPTION 'Signup gift stake must not count toward deposit turnover'; END IF;

  PERFORM public.apply_coin_delta(
    '00000000-0000-4000-8000-000000000010','purchased',-50,'match_entry',
    'finance-match-entry-102','00000000-0000-4000-8000-000000000102'
  );
  UPDATE public.matches SET status='completed' WHERE id='00000000-0000-4000-8000-000000000102';
  v_counted := public.complete_paid_match_turnover('00000000-0000-4000-8000-000000000102');
  IF v_counted<>50 THEN RAISE EXCEPTION 'Deposit-funded 50-coin stake should count 50 turnover, got %',v_counted; END IF;

  PERFORM public.apply_coin_delta(
    '00000000-0000-4000-8000-000000000010','purchased',-40,'match_entry',
    'finance-match-entry-103','00000000-0000-4000-8000-000000000103'
  );
  UPDATE public.matches SET status='completed' WHERE id='00000000-0000-4000-8000-000000000103';
  v_counted := public.complete_paid_match_turnover('00000000-0000-4000-8000-000000000103');
  IF v_counted<>40 THEN RAISE EXCEPTION 'Deposit-funded 40-coin stake should count 40 turnover, got %',v_counted; END IF;

  SELECT turnover_required,turnover_completed INTO v_required,v_completed
  FROM public.paid_coin_lots
  WHERE user_id='00000000-0000-4000-8000-000000000010' AND source_type='deposit';
  IF v_required<>90 OR v_completed<>90 THEN
    RAISE EXCEPTION 'Deposit rollover must be 90/90, got %/%',v_completed,v_required;
  END IF;
END
$deposit_turnover$;

-- Configure verification only through the privileged server path.
SELECT public.set_member_gate_verification(
 '00000000-0000-4000-8000-000000000010',true,true,false
);
SELECT public.apply_coin_delta(
 '00000000-0000-4000-8000-000000000010','purchased',200,'match_payout',
 'finance-match-payout-010','00000000-0000-4000-8000-000000000103'
);

SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000010',false);
SET ROLE authenticated;

DO $payout_address_submit$
DECLARE v_id uuid;
BEGIN
  v_id:=public.register_member_payout_address('USDT','TRC20','T_TEST_WITHDRAWAL_ADDRESS_123456789');
  INSERT INTO finance_test_ids(name,id) VALUES('payout_address_user_10',v_id);
  BEGIN
    PERFORM public.request_withdrawal(500,v_id);
    RAISE EXCEPTION 'Unverified payout address must not be withdrawable';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;
END
$payout_address_submit$;

RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT public.review_member_payout_address(
  (SELECT id FROM finance_test_ids WHERE name='payout_address_user_10'),true,'CI wallet address verification'
);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000010',false);
SET ROLE authenticated;

-- 450 credited deposit coins are insufficient even when the Value Wallet
-- contains the 50-coin signup gift and the 20% deposit turnover is complete.
DO $below_minimum_deposit_history$
DECLARE
  v_rejected boolean:=false;
  v_error text;
BEGIN
  IF (SELECT lifetime_deposit_coins FROM public.get_my_financial_summary())<>450 THEN
    RAISE EXCEPTION 'Precondition must be exactly 450 credited deposit coins';
  END IF;
  BEGIN
    PERFORM public.request_withdrawal(500,(SELECT id FROM finance_test_ids WHERE name='payout_address_user_10'));
  EXCEPTION WHEN SQLSTATE '22023' THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    v_rejected := v_error='verified_deposit_history_below_minimum';
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'A 450-coin credited deposit history must not satisfy the 500-coin withdrawal gate; got %',coalesce(v_error,'no error');
  END IF;
  IF (SELECT purchased_coins FROM public.coin_wallets WHERE user_id=auth.uid())<>560
     OR EXISTS(SELECT 1 FROM public.withdrawal_requests WHERE user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Rejected sub-minimum withdrawal must not reserve coins or create a request';
  END IF;
END
$below_minimum_deposit_history$;

-- A second, separate 50-coin credited deposit raises lifetime verified
-- deposits to 500. Its own 10-coin turnover must also be completed.
DO $second_deposit_claim$
DECLARE v_id uuid;
BEGIN
  v_id:=public.submit_deposit_claim(
    'USDC','TRC20',0.5,
    '0x2222222222222222222222222222222222222222222222222222222222222222',
    now()-interval '1 minute'
  );
  INSERT INTO finance_test_ids(name,id) VALUES('second_deposit_user_10',v_id);
END
$second_deposit_claim$;

RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT public.review_deposit_request(
  (SELECT id FROM finance_test_ids WHERE name='second_deposit_user_10'),true,'CI second manual deposit approval'
);

INSERT INTO public.matches(id,game_id,mode,economy_mode,status,entry_coins)
VALUES('00000000-0000-4000-8000-000000000104','chess','ranked','paid','active',370);
INSERT INTO public.match_participants(match_id,user_id,seat,final_result)
VALUES
 ('00000000-0000-4000-8000-000000000104','00000000-0000-4000-8000-000000000010',1,'win'),
 ('00000000-0000-4000-8000-000000000104','00000000-0000-4000-8000-000000000011',2,'loss');
SELECT public.apply_coin_delta(
 '00000000-0000-4000-8000-000000000010','purchased',-370,'match_entry',
 'finance-match-entry-104','00000000-0000-4000-8000-000000000104'
);
UPDATE public.matches SET status='completed' WHERE id='00000000-0000-4000-8000-000000000104';
SELECT public.complete_paid_match_turnover('00000000-0000-4000-8000-000000000104');
SELECT public.apply_coin_delta(
 '00000000-0000-4000-8000-000000000010','purchased',260,'match_payout',
 'finance-match-payout-010-104','00000000-0000-4000-8000-000000000104'
);

-- The 370-coin match first consumes the older winnings lot before reaching the
-- second deposit. A separate 200-coin completed match consumes the remaining
-- 190 winnings coins plus 10 coins from the second deposit; only those final
-- 10 deposit coins complete turnover. Winnings themselves do not count.
INSERT INTO public.matches(id,game_id,mode,economy_mode,status,entry_coins)
VALUES('00000000-0000-4000-8000-000000000106','chess','ranked','paid','active',200);
INSERT INTO public.match_participants(match_id,user_id,seat,final_result)
VALUES
 ('00000000-0000-4000-8000-000000000106','00000000-0000-4000-8000-000000000010',1,'win'),
 ('00000000-0000-4000-8000-000000000106','00000000-0000-4000-8000-000000000011',2,'loss');
SELECT public.apply_coin_delta(
 '00000000-0000-4000-8000-000000000010','purchased',-200,'match_entry',
 'finance-match-entry-106','00000000-0000-4000-8000-000000000106'
);
UPDATE public.matches SET status='completed' WHERE id='00000000-0000-4000-8000-000000000106';
SELECT public.complete_paid_match_turnover('00000000-0000-4000-8000-000000000106');
SELECT public.apply_coin_delta(
 '00000000-0000-4000-8000-000000000010','purchased',200,'match_payout',
 'finance-match-payout-010-106','00000000-0000-4000-8000-000000000106'
);

SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000010',false);
SET ROLE authenticated;

DO $access_and_withdrawal$
DECLARE
  v_free integer;
  v_paid integer;
  v_random boolean;
  v_private boolean;
  v_deposits bigint;
  v_remaining bigint;
  v_wallet bigint;
  v_credited_deposits bigint;
  v_withdrawal uuid;
BEGIN
  SELECT free_level,paid_level,paid_random_unlocked,paid_private_unlocked
  INTO v_free,v_paid,v_random,v_private
  FROM public.get_member_game_access('chess');
  IF v_free<>5 OR v_paid<>1 OR NOT v_random OR v_private THEN
    RAISE EXCEPTION 'Game unlock gates mismatch: free %, paid %, random %, private %',v_free,v_paid,v_random,v_private;
  END IF;

  SELECT lifetime_deposit_coins,turnover_remaining,value_wallet_coins
  INTO v_deposits,v_remaining,v_wallet
  FROM public.get_my_financial_summary();
  IF v_deposits<>500 OR v_remaining<>0 OR v_wallet<>500 THEN
    RAISE EXCEPTION 'Financial summary mismatch: deposits %, turnover remaining %, wallet %',v_deposits,v_remaining,v_wallet;
  END IF;

  SELECT count(*) INTO v_credited_deposits
  FROM public.deposit_requests
  WHERE user_id=auth.uid() AND status='credited';
  IF v_credited_deposits<>2 THEN
    RAISE EXCEPTION 'The first claimant must have exactly two manually credited deposits, found %',v_credited_deposits;
  END IF;

  v_withdrawal := public.request_withdrawal(500,(SELECT id FROM finance_test_ids WHERE name='payout_address_user_10'));
  INSERT INTO finance_test_ids(name,id) VALUES('withdrawal_user_10',v_withdrawal);
  IF (SELECT status FROM public.withdrawal_requests WHERE id=v_withdrawal)<>'pending' THEN
    RAISE EXCEPTION 'Withdrawal request must enter pending manual review';
  END IF;
  IF (SELECT purchased_coins FROM public.coin_wallets WHERE user_id=auth.uid())<>0 THEN
    RAISE EXCEPTION 'Withdrawal must reserve exactly 500 coins after the threshold is satisfied';
  END IF;
END
$access_and_withdrawal$;

RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT public.review_withdrawal_request(
  (SELECT id FROM finance_test_ids WHERE name='withdrawal_user_10'),
  'reject',null,null,'CI rejection and automatic refund'
);

DO $rejection_refund$
BEGIN
  IF (SELECT status FROM public.withdrawal_requests
      WHERE id=(SELECT id FROM finance_test_ids WHERE name='withdrawal_user_10'))<>'rejected' THEN
    RAISE EXCEPTION 'Rejected withdrawal status not persisted';
  END IF;
  IF (SELECT purchased_coins FROM public.coin_wallets WHERE user_id='00000000-0000-4000-8000-000000000010')<>500 THEN
    RAISE EXCEPTION 'Rejected withdrawal must refund the full reserved amount to the pre-request 500-coin balance';
  END IF;
END
$rejection_refund$;

-- User 12 has 500 credited deposit coins and completed turnover. A paid
-- first withdrawal consumes the daily limit; a subsequent request must fail
-- specifically because of that cap, not because an earlier request is pending.
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',false);
SET ROLE authenticated;
DO $daily_cap_deposit_claim$
DECLARE v_id uuid;
BEGIN
  v_id:=public.submit_deposit_claim(
    'USDC','TRC20',5.0,
    '0x3333333333333333333333333333333333333333333333333333333333333333',
    now()-interval '1 minute'
  );
  INSERT INTO finance_test_ids(name,id) VALUES('daily_cap_deposit_user_12',v_id);
END
$daily_cap_deposit_claim$;

RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT public.review_deposit_request(
  (SELECT id FROM finance_test_ids WHERE name='daily_cap_deposit_user_12'),true,'CI daily-cap member deposit approval'
);
INSERT INTO public.matches(id,game_id,mode,economy_mode,status,entry_coins)
VALUES('00000000-0000-4000-8000-000000000105','chess','ranked','paid','active',150);
INSERT INTO public.match_participants(match_id,user_id,seat,final_result)
VALUES
 ('00000000-0000-4000-8000-000000000105','00000000-0000-4000-8000-000000000012',1,'win'),
 ('00000000-0000-4000-8000-000000000105','00000000-0000-4000-8000-000000000011',2,'loss');
SELECT public.apply_coin_delta(
 '00000000-0000-4000-8000-000000000012','purchased',-150,'match_entry',
 'finance-match-entry-105','00000000-0000-4000-8000-000000000105'
);
UPDATE public.matches SET status='completed' WHERE id='00000000-0000-4000-8000-000000000105';
SELECT public.complete_paid_match_turnover('00000000-0000-4000-8000-000000000105');
SELECT public.apply_coin_delta(
 '00000000-0000-4000-8000-000000000012','purchased',60000,'admin_adjustment',
 'finance-admin-adjustment-012','CI daily withdrawal cap fixture'
);
SELECT public.set_member_gate_verification(
 '00000000-0000-4000-8000-000000000012',true,true,false
);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',false);
SET ROLE authenticated;
DO $member_12_payout_address$
DECLARE v_id uuid;
BEGIN
  v_id:=public.register_member_payout_address('USDT','TRC20','T_TEST_WITHDRAWAL_ADDRESS_987654321');
  INSERT INTO finance_test_ids(name,id) VALUES('payout_address_user_12',v_id);
END
$member_12_payout_address$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT public.review_member_payout_address(
  (SELECT id FROM finance_test_ids WHERE name='payout_address_user_12'),true,'CI wallet address verification'
);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',false);
SET ROLE authenticated;

DO $daily_cap$
DECLARE
  v_first uuid;
  v_rejected boolean:=false;
  v_error text;
BEGIN
  IF (SELECT lifetime_deposit_coins FROM public.get_my_financial_summary())<>500
     OR (SELECT turnover_remaining FROM public.get_my_financial_summary())<>0 THEN
    RAISE EXCEPTION 'Daily cap fixture must have 500 credited deposit coins and completed turnover';
  END IF;
  v_first:=public.request_withdrawal(50000,(SELECT id FROM finance_test_ids WHERE name='payout_address_user_12'));
  INSERT INTO finance_test_ids(name,id) VALUES('withdrawal_user_12',v_first);
END
$daily_cap$;

RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT public.review_withdrawal_request(
  (SELECT id FROM finance_test_ids WHERE name='withdrawal_user_12'),
  'approve',null,null,'CI approve request before recording the outgoing transfer'
);
SELECT public.review_withdrawal_request(
  (SELECT id FROM finance_test_ids WHERE name='withdrawal_user_12'),
  'paid','0x4444444444444444444444444444444444444444444444444444444444444444',499.9,'CI paid request to exercise rolling daily cap'
);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',false);
SET ROLE authenticated;
DO $daily_cap_second_request$
DECLARE v_error text; v_rejected boolean:=false;
BEGIN
  BEGIN
    PERFORM public.request_withdrawal(5000,(SELECT id FROM finance_test_ids WHERE name='payout_address_user_12'));
  EXCEPTION WHEN SQLSTATE '22023' THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    v_rejected := v_error='daily_withdrawal_limit_exceeded';
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Daily withdrawal cap was not the reason for rejection; got %',coalesce(v_error,'no error');
  END IF;
END
$daily_cap_second_request$;

-- Member-10 deposit count is asserted inside its own authenticated RLS scope above.
RESET ROLE;

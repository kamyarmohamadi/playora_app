# Playora — Live Supabase Migration Reconciliation Audit

**Audit date:** 2026-11-01  
**Project:** `playora-dev` (`nnowvfewtrfurnluhflt`)  
**Branch:** `feature/playora-platform-game-plugin-architecture-2026-10-22`  
**Audited code checkpoint:** `850182fc72d211c11618d2ac33b4a499660d1be1`

## Decision

**Do not run a bulk `supabase db push`, do not manually edit `supabase_migrations.schema_migrations`, and do not enable real-money/coin transfers yet.**

The live database is active and healthy (PostgreSQL 17.11.0.003, region `eu-central-1`), but the migration ledger is not a clean one-to-one match with the local migration files. The correct recovery path is a backed-up, object-by-object reconciliation followed by one migration at a time.

This report is based on read-only Supabase MCP queries on 2026-11-01. No production SQL or schema change was executed during this audit.

## 1. Observed live state

| Item | Live observation |
|---|---:|
| Migration ledger rows | 22 |
| Auth users | 2 |
| Public tables | 31 |
| `private` schema | Absent |
| Catalogue games | 8 total / 0 enabled |
| Registered plugin versions | 0 |
| Approved plugin artifact origins | 0 |
| Deposit networks | 0 enabled |
| Withdrawal networks | 0 enabled |
| Verified payout addresses | 0 |
| Deposit requests | 0 |
| Paid withdrawal requests | 0 |
| `platform_admin_members` | Absent |
| `platform_admin_audit_events` | Absent |
| Signup guard tables / hook | Absent |
| New installation-claim RPC | Absent |

The catalogue and financial-flow tables are already present, but no game or payment configuration is active. The absence of current deposit requests means there is no observed live deposit/withdrawal history to migrate at this time; re-check this before the eventual deployment because data can change.

## 2. Migration ledger anomalies

The remote ledger has repeated migration **names** under distinct version values:

| Recorded name | Remote versions |
|---|---|
| `plugin_registry_hardening` | `20261021223140`, `20261021223334` |
| `economy_tracks_and_value_signup_gift` | `20261031003308`, `20261031003317` |
| `seed_both_game_tracks` | `20261031003726`, `20261031003752` |

These are not duplicate version primary keys. They are repeated labels with separate version values. The remote ledger also uses generated timestamps and shortened names that do not exactly match some local filenames. Do not infer whether each row is safe to mark applied/reverted from its label alone. Compare the SQL body and resulting catalog objects first.

The remote ledger currently ends with:

- `20261031005556 / manual_financial_flows_and_turnover`

It does not contain records for these branch migrations:

- `20261031000500_private_finance_admin_control_plane.sql`
- `20261031000600_financial_fk_indexes.sql`
- `20261101000000_enforce_verified_deposit_withdrawal_minimum.sql`
- `20261101000100_signup_device_ip_guard.sql`
- `20261101000200_reject_anonymous_social_and_leaderboard_rpcs.sql`

## 3. Structural drift confirmed

### Finance administration control plane

The local `20261031000500` migration creates:

- `public.platform_admin_members`
- `public.platform_admin_audit_events`

Both are absent on the live project. The deployed finance-admin Edge Functions must not be considered operational until these tables exist, server-side role checks are exercised with real JWTs, and the owner identity has been provisioned safely.

### Finance foreign-key indexes

The local `20261031000600` migration adds indexes for 14 finance foreign keys and removes a redundant `deposit_requests_user_idx`. The live Performance Advisor currently reports 14 unindexed foreign keys and one duplicate index matching this gap. Confirm the actual index definitions before applying; do not blindly recreate/drop indexes.

### Withdrawal deposit-history gate

The live `public.request_withdrawal(bigint,uuid)` function exists, but the new 500-coin cumulative verified-deposit-history check is not confirmed deployed. The local November 1 migration replaces this function so only `deposit_requests.coin_amount` rows with `status='credited'` count. Signup gifts, rewards, winnings, refunds and current wallet balance do not count.

### Signup abuse controls

The live project does not yet contain the `private` schema, HMAC secret table, install-claim table, IP-attempt table, Before User Created function or installation-claim RPC. Keep `VITE_SIGNUP_DEVICE_GUARD_ENABLED=false` until the migration and live email/OAuth flows are verified. The hook must also be explicitly configured in Supabase Auth dashboard; applying its SQL alone does not enable the Auth hook.

### Anonymous-session authorization gap found during this follow-up review

The read-only function inventory identified four member-only RPCs whose live bodies check `auth.role()='authenticated'` and `auth.uid()`, but do not reject `auth.jwt()->>'is_anonymous' = true`:

- `list_social_relationships()`
- `send_friend_request(text)`
- `respond_friend_request(uuid,text)`
- `get_game_leaderboard_for_mode(text,text,integer)`

Supabase anonymous sign-ins use the `authenticated` Postgres role, so the role check alone is not a sufficient registered-member check. Their function definitions have an empty `search_path`, and the observed grants exclude `anon`; this is a narrower authorization gap, not evidence that anonymous users can bypass RLS on every table.

A branch-only remediation has now been added as `20261101000200_reject_anonymous_social_and_leaderboard_rpcs.sql`. It replaces the four RPC bodies with explicit `auth.jwt()->>'is_anonymous'` rejection while preserving authenticated-member grants. The migration is included in the PostgreSQL CI workflow, and `supabase/tests/social_leaderboard.sql` now verifies that all four calls fail when the JWT is anonymous but the database role is `authenticated`. CI run #1143 (`41260521018`) was queued at the time this report was updated. This source fix is **not deployed to the live database**.

## 4. Security Advisor findings

The live Security Advisor reports leaked-password protection disabled. Enable it in **Authentication → Security and Protection** (exact dashboard wording may vary), then test password signup and password changes.

The audit also found 11 public `SECURITY DEFINER` functions executable by `authenticated` and none by `anon`:

- `get_deposit_options`
- `get_game_leaderboard_for_mode`
- `get_member_game_access`
- `get_my_financial_summary`
- `get_withdrawal_options`
- `list_social_relationships`
- `register_member_payout_address`
- `request_withdrawal`
- `respond_friend_request`
- `send_friend_request`
- `submit_deposit_claim`

This finding is not by itself proof of an exploit: several are intentionally privileged RPCs. Review each body for explicit `auth.uid()` checks, ownership constraints, argument validation, an empty/fixed `search_path`, and least-privilege grants. Do not switch them all to invoker or revoke them in bulk; that could break legitimate server-authoritative flows or obscure a real authorization flaw.

### Data API exposure enforcement (effective 2026-10-30)

Supabase's October 28, 2026 breaking-change notice says public tables are no longer automatically exposed to the Data and GraphQL APIs, with enforcement on all projects from October 30. For every table needed by the client, verify explicit table grants and RLS independently; `public` schema membership alone is not evidence of API access. The read-only diagnostic's final query inventories current grants and RLS state. Keep finance/admin/internal tables unexposed and grant only the exact roles and operations required.

Reference: [Supabase changelog — Tables not exposed to Data and GraphQL API automatically](https://supabase.com/changelog?tags=database).

The current Before User Created Hook documentation confirms the hook payload includes `metadata.ip_address` and `user.user_metadata`, and that a Postgres function may return an `error` object with `http_code` and `message`. This matches the JSON fields used by the local Playora hook; the live Supabase dashboard hook still needs to be configured and exercised with real email/OAuth signup tests.

Reference: [Supabase Before User Created Hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook).

## 5. Safe reconciliation sequence

1. **Freeze schema-changing activity.** No Dashboard SQL edits, no migration pushes, no migration repairs, and no deployment during the comparison.
2. **Create and verify a recoverable backup.** Use the backup/PITR capability available on the actual Supabase plan. Confirm the recovery point and how restoration would be performed before continuing. Export a schema snapshot as an additional comparison artifact; a schema-only export is not a data backup.
3. **Run the read-only diagnostics** in `supabase/diagnostics/live_migration_reconciliation.sql`. Save the complete result beside this report.
4. **Map every remote ledger row to a local SQL file.** For the three repeated names, compare file contents, object definitions, constraints, policies, triggers and grants. Decide row-by-row whether a row corresponds to a real applied SQL change or an erroneous ledger entry.
5. **Reconcile only after evidence is complete.** Use the Supabase CLI migration-repair workflow only for confirmed ledger corrections. Never delete or rewrite history manually in SQL.
6. **Apply the missing migrations one at a time** in dependency order: finance admin control plane, finance FK indexes, withdrawal-history gate, signup abuse guard. Before each step, verify prerequisites and that its effects are not already present; after each step, rerun the diagnostics and the relevant integration tests.
7. **Configure Auth separately.** Set the Before User Created hook to `pg-functions://postgres/public/hook_playora_before_user_created` only after the hook migration is live; keep the feature flag off until email and OAuth tests succeed.
8. **Re-run Advisors and actual-user tests.** Test at least two real authenticated members and the finance-admin roles with valid JWTs. Verify RLS, RPC grants, audit events, signup limits, duplicate-device behavior, the 500-coin gate and turnover behavior.
9. **Only then configure payment networks and payout addresses.** Values must be independently verified; do not enable a network using placeholder addresses or estimated exchange rates.

## 6. Current release gates

- [ ] Backup/PITR recovery point verified.
- [ ] Remote migration ledger reconciled against local SQL bodies.
- [ ] Finance admin tables and role authorization deployed and tested.
- [ ] Finance foreign-key indexes applied; Advisor rechecked.
- [ ] New 500 credited-deposit-coin withdrawal gate deployed and tested.
- [ ] Signup abuse migrations applied; Auth hook configured and tested.
- [ ] Leaked-password protection enabled.
- [ ] Public SECURITY DEFINER functions reviewed individually.
- [ ] Edge Functions deployed and verified with real member/admin JWTs.
- [ ] Owner identity provisioned out-of-band.
- [ ] Payment networks and payout addresses validated and deliberately configured.
- [ ] Game plugin versions registered, artifact origins approved, and games independently tested.
- [ ] Production hosting, HTTPS/CSP/headers, monitoring, backup alerts and load tests complete.
- [ ] Independent security review complete.

## 7. Reference material

- Supabase [Database Migrations guide](https://supabase.com/docs/guides/deployment/database-migrations)
- Supabase [Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- Supabase [Backups guide](https://supabase.com/docs/guides/platform/backups)
- Supabase [Migration CLI reference](https://supabase.com/docs/reference/cli/supabase-migration)
- Supabase [Security Advisor](https://supabase.com/dashboard/project/nnowvfewtrfurnluhflt/database/security-advisor)
- Supabase [Performance Advisor](https://supabase.com/dashboard/project/nnowvfewtrfurnluhflt/database/performance-advisor)


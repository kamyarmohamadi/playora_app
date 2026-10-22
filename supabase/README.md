# Supabase setup — Playora

The development Supabase project has been provisioned and the listed development migrations have been applied and tested in CI. This document is not evidence of a production deployment; production remains a separate gated task.

## 1. Reconnect to the existing development project

1. The development project already exists: `playora-dev`, project ref `nnowvfewtrfurnluhflt`, region `eu-central-1`. Use https://supabase.com/dashboard/project/nnowvfewtrfurnluhflt to open it. Create a separate production project only after a cost/data-residency/backup review.
2. In Auth, enable email confirmation and configure secure redirect URLs. Configure Google OAuth credentials in Supabase Auth before enabling the Google button.
3. Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. These are browser configuration values, not service-role credentials.
4. Keep SUPABASE_SERVICE_ROLE_KEY exclusively in server-side Edge Function secrets. Never prefix it with VITE_, expose it in browser code or commit it.
5. For a **new empty project only**, review and apply source migrations in order. For the existing `playora-dev`, do not blindly replay migrations: the connected migration history has duplicate `plugin_registry_hardening` labels and connector-applied versions that do not map one-to-one to filename prefixes. Reconcile local and remote migration history before using the CLI or running any push. Current source files to review include:
   - supabase/migrations/20261020000000_secure_member_data.sql
   - supabase/migrations/20261020010000_private_rooms.sql
   - supabase/migrations/20261020020000_social_and_leaderboard.sql
   - supabase/migrations/20261020030000_limit_match_uuid_visibility.sql
   - supabase/migrations/20261020040000_account_deletion.sql
   - supabase/migrations/20261021000000_platform_only_disable_game_rpc.sql
   - supabase/migrations/20261022000000_platform_game_plugin_registry.sql
   - supabase/migrations/20261023000000_plugin_registry_hardening.sql
   - supabase/migrations/20261023000100_plugin_origin_state_guards.sql
   - supabase/migrations/20261023000200_registry_origin_actor_index.sql
   - supabase/migrations/20261024000000_catalog_art_key.sql
   - supabase/migrations/20261025000000_plugin_capability_grants.sql
6. During the platform-only phase, all catalog games remain disabled and the legacy ranked/private Tic Tac Toe RPCs are revoked from browser roles. Do not re-grant them in a live project. CI's disposable database grants these functions inside test fixtures only to keep legacy SQL invariants covered.
7. Function source is tracked in `supabase/functions/`, but the live project currently reports zero deployed Edge Functions. Deploy `member-self` only after Auth/JWT, origin, secret and endpoint reviews pass, then verify it against the live project. Do not deploy `delete-account` until its full disposable-account end-to-end test and cleanup verification pass.
9. Configure PLAYORA_ALLOWED_ORIGINS as a comma-separated allowlist of exact frontend origins (for example, the production HTTPS origin and localhost during development). Do not use a wildcard. Check that the Edge Function has SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY available as server-side secrets; never paste them in frontend environment variables or the repository.
10. Test email signup/confirmation, sign-in, password recovery and OAuth redirects against this exact project.

Do not run supabase db push or apply migrations to an existing project until table names, policies, extensions and migration conflicts have been reviewed and backed up.

## 2. Account deletion

The delete-account Edge Function accepts only an authenticated POST request with a JSON body containing confirmation: DELETE. It validates the token with Supabase Auth, requires auth_time within the prior ten minutes, runs the server-role-only prepare_account_deletion RPC, and then deletes the Auth user through the Auth Admin API. The service-role key never reaches the browser.

The RPC cancels a member's waiting/matched queue entries, cancels unfinished matches involving that member, cancels matching opponent queue entries, clears pending results, and closes rooms the member hosts or joined. It deliberately makes no changes to XP, competitive rating, match wins/losses, or coins. The Auth Admin deletion then cascades the member's private database rows.

The UI feature flag stays off by default. Keep VITE_ACCOUNT_DELETION_ENABLED=false until the migration and Edge Function are deployed to a development project and have passed an end-to-end test. Only then enable the flag in the frontend deployment environment. The local feature flag does not enable the server function or replace its security checks.

## 3. Member-data isolation tests

The GitHub Actions workflow applies all migrations and runs these SQL tests against a disposable PostgreSQL 16 database:

- supabase/tests/security_invariants.sql
- supabase/tests/game_plugin_registry.sql
- supabase/tests/wallet_ledger.sql
- supabase/tests/rls_member_isolation.sql
- supabase/tests/ranked_tictactoe.sql
- supabase/tests/private_rooms.sql
- supabase/tests/social_leaderboard.sql
- supabase/tests/account_deletion.sql

The bootstrap is a test-only minimal Auth schema shim. It does not replace integration tests against real Supabase Auth/JWTs. In the real project, use at least two distinct authenticated test accounts and attempt cross-member reads/writes by substituting UUIDs. Verify all cross-member access is denied.

## 4. Wallet and payment boundary

Browser clients cannot create wallet credits, edit ledger entries, mark a payment verified, or set match winners/rankings. The apply_coin_delta RPC is server-role-only, transactional and idempotent. Do not call it from the browser or expose a service-role key.

A real payment processor/on-chain watcher, idempotent transaction reconciliation and incident workflow are not implemented yet; do not enable deposits, coin purchases, paid entry or convertible prizes. The existence of deposit-request tables does not mean that deposits are operational.

Private-room invite codes are high-entropy random values; only a SHA-256 hash is persisted. Room state and match moves are server-authoritative. Direct reads of internal opponent, host, and friend-request Auth UUIDs are restricted; clients use scoped RPCs and their own participant row.

## 5. Release gate

Before production, complete real Supabase RLS integration tests, session/verification settings, rate limits and abuse controls, monitoring/logging without secrets, backups/recovery, data retention/deletion workflows, dependency/security scans, actual hosting security headers, a real-time service capacity plan, and an independent threat-model review.

public/_headers is a template for compatible static hosts only. It is not automatically enforced on every hosting provider; configure equivalent headers on the selected host and test the effective CSP against the actual Supabase URL.


## 6. Plugin registry safety gate

The trusted artifact-origin allowlist is empty by default. A server-only workflow must explicitly approve an HTTPS origin before registering any artifact. Plugin records begin in `draft` and must pass review before enablement; artifact identity is immutable, and revoking an origin revokes its associated plugin versions. Public clients can read only enabled plugin metadata whose catalog entry is visible and enabled. These controls do not themselves make an unreviewed plugin safe to execute: the isolated runtime, sandbox headers, artifact digest verification and a reviewed capability broker remain mandatory before any game is enabled.


## Explicit plugin capability grants

The plugin manifest lists requested capabilities, but requested capabilities are not automatically granted. The trusted registry stores a separate granted_capabilities array. Database constraints restrict grants to capabilities that were requested and to the platform allowlist. Grants are frozen after the record reaches approved state, and browser roles can read the grant list only for enabled registry records but cannot change it. The host receives only this explicit grant list; backend endpoints must still enforce authorization independently.


## Current verified external state (2026-10-22)

The project is active/healthy and the source migrations are tracked. The live catalogue has 8 visible metadata rows, no enabled games, no plugin versions, and no approved artifact origins. RLS is enabled on the catalog and plugin registry tables. Browser roles cannot write plugin registry state or read the trusted artifact-origin allowlist. The connected project tool reports zero deployed Edge Functions at this checkpoint; local function source is not the same as a deployed endpoint.

For a complete device/session recovery procedure, current CI link, private-repository branch, exact project links, secret boundary and remaining setup work, read [docs/RECOVERY_AND_CONTINUATION.md](../docs/RECOVERY_AND_CONTINUATION.md). Do not store populated keys or passwords in this file or in GitHub commits.

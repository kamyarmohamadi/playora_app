# Playora Platform and Supabase Staging Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` after owner review of this plan. The real Supabase project creation is a separate owner-approval gate; do not create or configure external resources before that gate is satisfied.

**Goal:** Complete and verify platform-level account, profile, preferences, catalog, social, support-intake, and safe wallet/status flows against a real staging backend, while keeping all games non-launchable until the separate plugin/runtime gate passes.

**Architecture:** Use Supabase Auth with verified sessions, Postgres with reviewed migrations and least-privilege grants/RLS, and narrowly scoped Edge Functions for trusted operations. The platform reads public game metadata separately from approved/launchable plugin state. Existing game-specific RPCs remain non-live/disabled until a game package is later approved. Use disposable test members for live isolation tests.

**Tech Stack:** Existing Supabase JS v2 client, Supabase/Postgres migrations, Edge Functions (Deno), GitHub Actions, current React/Vite app and TypeScript contracts. Use a checked CLI version and official current Supabase docs.

**Spec:** `docs/superpowers/specs/2026-10-22-playora-platform-game-plugin-architecture.md`

**Setup audit:** `docs/supabase/SUPABASE_READINESS_AUDIT_2026-10-22.md`

**Prerequisite plans:** `docs/superpowers/plans/2026-10-22-playora-platform-core-game-sdk.md` and `docs/superpowers/plans/2026-10-22-playora-secure-plugin-runtime.md`. Registry database contracts depend on the approved SDK manifest.

## Global Constraints

- No Supabase project creation until the owner explicitly confirms the target organization and the project setup choice.
- Current available organization's cost tool quote is $0/month base on the Free plan; this is not a guarantee of always-on production hosting or unlimited usage.
- Never use production member data for tests; use a fresh development/staging project and disposable test accounts.
- Never commit or expose database password, service-role/secret key, OAuth client secret, auth token, wallet seed phrase or private key.
- Every exposed table must have explicit minimum grants and suitable RLS. Every exposed function must have narrowly scoped execution grants; RLS does not apply to function execution.
- Server identity must come from verified request context; never authorize using a client-supplied `user_id`.
- Until the plugin host and package have passed their release gate, every game is non-launchable. Test fixtures may temporarily enable legacy game code only in a disposable CI database.
- Wallet/ledger, match outcomes, ratings, deposit state, prizes and staff permissions remain server-authoritative.
- Keep account deletion disabled until its live Auth Admin flow passes end-to-end tests; keep deposits, crypto, paid entry, prize tournaments and convertible rewards disabled.
- This plan does not implement the admin panel. Owner/staff RBAC UI remains separately deferred.

## Review Focus

- **Incorrect project/target:** migrations must only run against the explicitly selected new development project; never silently link/push to production or an unknown database.
- **Cross-member access:** Member A must never read or write Member B's private rows by substituting IDs, and must not fetch other members' auth UUIDs or private details.
- **New Data API defaults:** after the 2026-10-30 change, explicit grant behavior must be verified for the actual project; RLS alone is not enough.
- **Missing/expired Auth:** no authenticated-only endpoint works with missing/invalid/expired sessions; failures cannot leave the UI in a fake signed-in state.
- **Secret/config mistake:** browser bundle and diagnostics must not contain service-role keys, database passwords, auth tokens, OAuth secrets, or private financial values.

---

### Task 1: Provision a development project (owner approval required)

**Files:**
- Read/update: `docs/supabase/SUPABASE_READINESS_AUDIT_2026-10-22.md`
- Update: `docs/PROJECT_CHECKPOINT_2026-10-22.md`

**Interfaces:**
- Project name: `playora-dev`
- Suggested organization: the currently visible Free organization, only if explicitly confirmed by the owner.
- Suggested region: `eu-central-1` (EU Central / Frankfurt), subject to the owner's data-residency choice.

- [ ] Obtain explicit owner confirmation of the organization and region before using the create-project action.
- [ ] Review and repeat the current cost quote; do not treat a past price result as timeless.
- [ ] Create only a development/staging project. Do not create a production project in this task.
- [ ] Wait for project status to reach ready and query the project metadata, URL and publishable keys via the connected Supabase tools.
- [ ] The owner sets/stores the DB password privately; never ask them to paste it into chat.
- [ ] Record only safe metadata (project reference, region, purpose, created date, plan) in the checkpoint; never store the DB password or service-role key.
- [ ] If the owner has not approved project creation, leave the task blocked and continue only with offline/CI work.

### Task 2: Reconcile migration behavior with the no-games-yet release scope

**Files:**
- Modify before the first live apply: `supabase/migrations/20261020000000_secure_member_data.sql`
- Modify: `supabase/tests/ranked_tictactoe.sql`
- Modify: `supabase/tests/private_rooms.sql`
- Modify: `supabase/tests/security_invariants.sql`
- Modify: `supabase/README.md`
- Create a follow-up migration only if the source migration has already been applied to a real project.

- [ ] Add a failing test proving that a new production-style database has no enabled/launchable games by default.
- [ ] Remove the source migration's automatic enablement of Tic Tac Toe before any live project has applied that migration.
- [ ] Keep all catalog titles available as safe metadata if needed, but separate visibility in the catalog from whether a verified game artifact can launch.
- [ ] Update CI-only SQL test fixtures to explicitly enable Tic Tac Toe where legacy matchmaking/private-room invariants need to be tested. This state must never be seeded as enabled in the real staging environment during the platform-only phase.
- [ ] Verify that ranked queue/room RPCs reject requests when no game is approved/enabled and that browser routes do not call those RPCs with no plugin installed.
- [ ] Do not rewrite an applied migration after it has been applied to the live project; if that happens, create a new forward migration using the checked Supabase CLI workflow.
- [ ] Run all PostgreSQL CI tests and save outputs; commit.

### Task 3: Review and apply database migrations safely

**Files:**
- Read/modify as needed: `supabase/config.toml`
- Read: all existing `supabase/migrations/*.sql`
- Modify: `supabase/README.md`
- Modify: `docs/SECURITY_MODEL.md`
- Modify: `docs/PRODUCTION_READINESS.md`

- [ ] Check the installed Supabase CLI version and `supabase --help`, `supabase db --help`, and `supabase migration --help` before choosing commands. Do not guess command flags.
- [ ] Confirm the project ref belongs to `playora-dev`; confirm no unexpected tables/extensions/policies exist before applying the migration chain.
- [ ] Review every `SECURITY DEFINER` function for a fixed safe `search_path`, schema-qualified references, request identity check, input validation, concurrency/transaction boundaries, idempotency and a minimal execution grant.
- [ ] Review every `GRANT` and `REVOKE` for tables, sequences, views and functions. No client role may write balances, immutable ledger rows, match outcomes, rating/XP, deposits, audit records or plugin approval state.
- [ ] Enable RLS on each exposed user-data table and keep internal tables out of the Data API unless there is a specific need.
- [ ] Test the new Data API explicit-exposure behavior and bundle minimum required grants with the migration for each accessed object.
- [ ] Apply reviewed migrations in timestamp order to the clean development project. Do not apply to any other target.
- [ ] Run migration listing, table introspection, database type generation, and Security Advisor; save findings and remediate relevant issues before the next step.
- [ ] Run the same migrations and SQL invariant tests in CI's disposable PostgreSQL database; commit reviewed corrections.

### Task 4: Add a trusted, read-only public catalog and plugin registry schema

**Files:**
- Create: migration generated using `supabase migration new <descriptive-name>` after checking CLI help; do not invent a CLI-generated timestamp
- Modify: `supabase/tests/security_invariants.sql`
- Create: `supabase/tests/plugin_registry.sql`
- Modify: `supabase/README.md`
- Modify: the registry types/provider from the core plan

**Interfaces:**
- Safe catalog metadata is distinct from the launchable artifact/version.
- Suggested tables: `game_plugins` for public catalog metadata and `game_plugin_versions` for immutable manifest/artifact/version/capability metadata.
- Trusted registry states: `draft | review | approved | enabled | disabled | revoked`; only a trusted path changes state.
- Browser clients receive only public/safe metadata for catalog-visible rows and approved/enabled artifact descriptors; they cannot create/update/delete plugin records.

- [ ] Write SQL tests proving anonymous/signed-in reads return only intentionally published safe catalog data and no draft/private registry rows.
- [ ] Write negative tests proving anon/authenticated cannot insert/update/delete plugin metadata, mark a plugin enabled, change artifact digest, or grant capabilities.
- [ ] Define constraints for stable IDs, semantic versions, supported SDK range, artifact URL/origin, SHA-256 digest, metadata length and state-transition rules.
- [ ] Apply explicit grants with the table schema, and use RLS policies that permit only the specific public read use case. Keep write access unavailable to browser roles.
- [ ] Keep plugin registry changes on a reviewed deployment/migration path until the separately deferred admin console has a secure publisher workflow.
- [ ] Add migration tests ensuring no games are enabled by default. Run PostgreSQL CI, live staging SQL tests and Security Advisor, then commit.

### Task 5: Configure Auth, browser environment and provider settings

**Files:**
- Modify: `.env.example` (names/comments only; no real values)
- Modify: `src/lib/supabase.ts` if testing reveals necessary corrections
- Modify: `docs/PRODUCTION_READINESS.md`
- Modify: `supabase/README.md`
- Test: existing Auth/session tests and new staging integration tests

- [ ] Configure the development project's Site URL and exact redirect allowlist for the local Vite origin and tested preview origin only.
- [ ] Enable email confirmation and configure password/security and rate-limit settings according to current Supabase docs.
- [ ] Use the project URL and publishable/anon key only for browser configuration; verify the service-role/secret key is never in `VITE_*` variables.
- [ ] Leave Google OAuth disabled until valid OAuth client credentials and exact redirect URLs are configured.
- [ ] Test signup, email confirmation, sign-in, sign-out, expired/invalid session, password recovery, failed OAuth, refresh and rapid member switching.
- [ ] Add tests proving account-switching cannot let a delayed response from Member A overwrite Member B's profile/wallet state.
- [ ] For public/production email, configure a trusted SMTP sender and verify deliverability/limits; never commit SMTP credentials.
- [ ] Confirm every route reports "backend not connected" or safe error state when config is missing. It must not fabricate real account success.
- [ ] Run unit tests/typecheck/build and staging browser tests; commit.

### Task 6: Deploy and test the existing trusted Edge Functions

**Files:**
- Read: `supabase/functions/member-self/index.ts`
- Read: `supabase/functions/delete-account/index.ts` and `index_test.ts`
- Modify only if tests/review require it: these function files and their unit tests
- Modify: `supabase/config.toml`
- Modify: `supabase/README.md`

- [ ] Deploy `member-self` to `playora-dev` only after function source, JWT policy, CORS and input checks are reviewed.
- [ ] Configure exact `PLAYORA_ALLOWED_ORIGINS` values for local and approved staging origins; wildcard origins are forbidden.
- [ ] Set required function secrets in the Supabase server-side secret store. Never place the service-role key into browser config, source code, logs or ChatGPT.
- [ ] Test missing/invalid/revoked JWT, cross-member identifier substitution, allowed/denied Origin, malformed methods/body and safe error messages.
- [ ] Keep `delete-account` and `VITE_ACCOUNT_DELETION_ENABLED` off until disposable-account E2E proves recent-authentication checks, explicit confirmation, unfinished-match/room cleanup, Auth Admin deletion, retries and no reward side effects.
- [ ] Run Deno check/test workflows and staging tests. Save exact outputs and commit any reviewed source changes.

### Task 7: Complete platform-owned persistence and support intake

**Files:**
- Create/modify platform services and components under `src/platform/`
- Create reviewed migration(s) for public support-report intake and replies
- Create: `supabase/tests/support_reports.sql`
- Modify: `src/App.test.tsx` and any focused platform-service tests
- Modify: `docs/SECURITY_MODEL.md`

- [ ] Inventory every platform route and mark which actions are currently local preview, truly persisted, backend-unavailable or deferred. Remove misleading fake-success states.
- [ ] Implement real member profile/preferences/favorites/social operations using the reviewed existing tables/RPCs and server-derived identity.
- [ ] Provide a public `Report a problem` entry point with one durable ticket per submission. A reporting outage must not block gameplay/navigation.
- [ ] Persist only sanitized diagnostics: app release, browser/OS family, locale, route template, safe error code/stack, request correlation ID and bounded safe breadcrumbs. Redact tokens, cookies, auth headers, credentials, private messages, private keys and seed phrases on both client and server.
- [ ] Use idempotency keys for retried report submission; individual tickets remain distinct, and shared incident grouping is deferred until sufficient technical evidence exists.
- [ ] Member policies let each member read only their own reports/replies. Clients cannot set staff severity/assignment, write audit events, read another member's diagnostics, or mutate staff incident state.
- [ ] Do not build the admin support dashboard in this task. The staff console remains explicitly deferred.
- [ ] Keep wallet UI read-only/informational, with no deposit/payment/transfer flow. Keep tournament/reward screens clearly unavailable until later reviewed services exist.
- [ ] Test cross-member denial, secret redaction, retry/idempotency and report API failure recovery; run full CI and staging integration tests; commit.

### Task 8: Verify server-authoritative platform boundaries

**Files:**
- Modify/create: `supabase/tests/*.sql`
- Modify/create: Edge Function tests
- Modify: `docs/PRODUCTION_READINESS.md`
- Modify: `docs/SECURITY_MODEL.md`

- [ ] Use at least two real development Auth accounts for cross-member read/write tests, including profiles, preferences, favorites, wallets, ledgers, rooms, relationships and support reports.
- [ ] Verify no browser request can set identity as another user, change balances/ledger rows, write result/rating fields, mark deposits verified, or alter plugin approval state.
- [ ] Verify role/capability policies on all exposed functions; review any `SECURITY DEFINER` exceptions and default function grants.
- [ ] Verify wallet deltas (when exercised in isolated tests) are transactional/idempotent, do not double-credit on retry, reject conflicting replays, and cannot produce a negative balance.
- [ ] Verify no real reward, payment, account deletion, or game launch becomes active due only to local storage or frontend flags.
- [ ] Run Supabase Security Advisor and inspect the relevant logs for the tested range. Redact tokens and personal information in saved evidence.
- [ ] Commit the security test results and list unresolved findings; do not waive an unresolved high-severity issue for convenience.

### Task 9: Platform-only browser QA and release gate

**Files:**
- Modify: `playwright.config.ts` and browser tests from the runtime plan
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/PRODUCTION_READINESS.md`
- Update: `docs/PROJECT_CHECKPOINT_2026-10-22.md`

- [ ] Run browser journeys for empty/disabled game catalog, sign-up/login/recovery where configured, profile/preferences, favorites/social, report-a-problem, logout/session expiry and safe wallet/deposit-disabled states.
- [ ] Run desktop and narrow-mobile tests, Persian RTL, keyboard focus, menu/dialog operations, browser console/page errors and failed-request checks.
- [ ] Test with missing Supabase config and with staging network/API failures; the rest of the shell must remain usable with accurate status messaging.
- [ ] Inspect the actual staging hosting headers/CSP; do not claim `public/_headers` is effective until confirmed on the selected host.
- [ ] Confirm CI has green tests, typecheck, production build, dependency audit, SQL tests, Deno tests and E2E on the exact release commit.
- [ ] Save a dated release report/checkpoint in GitHub and provide a verified browser preview or screenshots. If no host/URL is configured or verifiable, state that limitation instead of inventing a link.
- [ ] Keep all games disabled until both core/SDK and isolated-runtime exit gates have passed. Then request a separate readiness review before the first game package is built.

## Exit gate

Staging readiness is achieved only when the project is explicitly provisioned, migrations and functions are deployed through a reviewed path, Auth/RLS are tested with real accounts, explicit grants are verified under current Data API defaults, platform persistence/support APIs pass tests, security findings are reviewed, and browser journeys pass. Production readiness additionally requires a separate production environment, actual domain/hosting, custom SMTP, backup/recovery, monitoring, load/abuse tests, cost review and independent security review.

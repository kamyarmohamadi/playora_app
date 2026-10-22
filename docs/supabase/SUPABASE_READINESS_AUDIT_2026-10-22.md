# Supabase Readiness Audit — Playora

- Audit date: 2026-10-22
- Status: post-provisioning audit. The development project exists and is active/healthy; production readiness has **not** been established.
- Repository: `kamyarmohamadi/playora_app`
- Active branch: `feature/playora-platform-game-plugin-architecture-2026-10-22`
- Recovery guide: [RECOVERY_AND_CONTINUATION.md](../RECOVERY_AND_CONTINUATION.md)

## 1. Verified current account and project status

| Item | Finding |
|---|---|
| Supabase organization | The connected owner's Free organization |
| Project | `playora-dev` |
| Project reference | `nnowvfewtrfurnluhflt` |
| Region | EU Central (`eu-central-1`) |
| Dashboard | https://supabase.com/dashboard/project/nnowvfewtrfurnluhflt |
| Project API URL | https://nnowvfewtrfurnluhflt.supabase.co |
| Project status | `ACTIVE_HEALTHY` |
| Current project records | 8 visible catalog metadata rows; 0 enabled catalog games; 0 plugin versions; 0 approved artifact origins |
| RLS | Enabled for `catalog_games`, `game_plugin_versions`, and `game_plugin_artifact_origins` |
| Browser plugin registry access | Client roles cannot write plugin state or read trusted artifact-origin approvals |
| Legacy ranked Tic Tac Toe RPC | Not executable by the authenticated browser role |
| Deployed Edge Functions | None reported by the connected project tool at last verification |
| Base project quote at creation | $0/month under the Free plan; current price/quotas must be rechecked before production |

Project/API links are configuration metadata, not credentials. The browser publishable/anon key can be retrieved from the project dashboard for a local `.env.local`; no populated key or password belongs in source control. The service-role/secret key must remain server-side.

## 1.1 Important operational caveats

- The connected migration history contains 13 entries and repeats the label `plugin_registry_hardening`. Some migration versions were applied through the connected project tool with timestamps different from the filename prefixes. Reconcile local files against the actual remote history before using the Supabase CLI or running `db push`; do not blindly replay any migration.
- The current source tree contains the Edge Function implementations, but the remote project reports zero deployed functions. The functions are not live until explicitly deployed and tested.
- Auth Site URL/redirects, Google OAuth credentials, SMTP/email delivery, a real frontend hosting domain, CSP headers, two-user Auth/JWT browser testing and the separate game-artifact host are not all configured or verified complete.
- The platform release gate is intentionally closed. No game is enabled or launchable.
- The development project had a $0/month base quote at creation. Free-plan pause/usage limitations and all current prices must be reviewed again before any production decision.

Official references:
- Billing: https://supabase.com/docs/guides/platform/billing-on-supabase
- Pricing: https://supabase.com/pricing

## 2. Important upcoming Data API behavior

Supabase's official changelog states that automatic Data API exposure of new public-schema tables is being changed: the new default applied to newly created projects from 2026-05-30 and is enforced across all projects on **2026-10-30**.

References:
- Changelog: https://supabase.com/changelog?types=breaking-change
- Data API security guide: https://supabase.com/docs/guides/api/securing-your-api

This matters because database access has two separate layers:
1. Postgres grants decide whether a role can reach a table/function through the Data API.
2. RLS policies decide which rows the role can access.

RLS does not replace grants, and grants do not replace RLS. For new Playora tables and functions, the migration must explicitly grant only required permissions, enable RLS for exposed user-data tables, add appropriate policies, and restrict function execution. After provisioning, verify the actual behavior through the project's Data API instead of assuming that a successful SQL migration means the frontend can query a table.

Static inspection shows that the current core migration already contains explicit table grants/revokes and RLS for its listed tables, and the social migration explicitly locks down `social_action_events`. That is a useful foundation, but it is **not** yet proof against a real Supabase project's current defaults. Review every table/function grant and run live integration tests after applying migrations.

## 3. Repository-side migration audit

The existing repository contains these migrations, in this order:

1. `supabase/migrations/20261020000000_secure_member_data.sql`
2. `supabase/migrations/20261020010000_private_rooms.sql`
3. `supabase/migrations/20261020020000_social_and_leaderboard.sql`
4. `supabase/migrations/20261020030000_limit_match_uuid_visibility.sql`
5. `supabase/migrations/20261020040000_account_deletion.sql`

The first migration defines 18 public tables and enables RLS on them. The social migration adds `social_action_events`, enables RLS and revokes direct client-role access. The CI workflow applies all five migrations to disposable PostgreSQL 16 and runs SQL security, wallet, member-isolation, ranked Tic Tac Toe, room, social and account-deletion tests. A minimal Auth shim in CI is not a substitute for live Supabase Auth/JWT testing.

### Required correction before any live staging rollout

The initial migration contains:

`update public.catalog_games set is_enabled = true where id = 'tictactoe';`

That behavior conflicts with the newly approved delivery order: the platform must first become independent of all games, and games are to be packaged/added only after the platform acceptance gate. Before applying migrations to staging, change the registry semantics so no game is launchable by default. Do not expose ranked or private game sessions as ready until the generic plugin host, game package and server-authoritative implementation have independently passed their gates. Keep legacy engine code for later packaging; do not delete it.

### Required review of trusted SQL functions

Before a live deploy, review every function created or replaced in these migrations for:
- `SECURITY DEFINER` use only where necessary;
- a fixed, safe `search_path` and schema-qualified references;
- identity derived from a verified request/auth context, never trusted client-supplied user IDs;
- explicit `REVOKE` / `GRANT EXECUTE` for each callable function, including defaults inherited from `PUBLIC`;
- transactionality, idempotency, race conditions, rate limits and state-transition validation;
- no client route to edit wallet, ledger, match result, rating, deposit-verification, audit or privileged role data;
- no secrets in function responses or logs.

Some current function bodies call `auth.role()`. The current Supabase guidance warns against its use as an authorization predicate in RLS policies in favor of explicit policy roles. Do not perform a blind replacement in PL/pgSQL; review each function-level use against current documentation and cover the chosen identity/role check with tests.

### Other current source boundaries

- `.env.example` contains empty browser config values for the project URL and publishable/anon key; no service-role key is declared there.
- `src/lib/supabase.ts` fails closed when the project URL/key are missing.
- Account deletion is behind `VITE_ACCOUNT_DELETION_ENABLED=false` by default.
- Existing match/room RPCs are game-specific to Tic Tac Toe. They must be treated as legacy services, not as the generic plugin contract.
- There is not yet a plugin-registry/approved-artifact persistence model in the database.
- No audit of remote-host secrets, deployed Auth settings or actual database advisories is possible before a project exists.
- Real deposits, crypto confirmations, paid-entry tournaments and prize fulfillment remain disabled.

## 4. What must be configured after a development project exists

### A. Project and credentials
- [ ] Owner confirms the target organization and EU region before the project is created.
- [ ] Create `playora-dev`; retain the exact project reference/URL in the deployment record.
- [ ] Set a long, unique database password and store it in a password manager. Do not send it through ChatGPT or commit it.
- [ ] Retrieve only the project URL and publishable/anon key for browser configuration. These are designed for client use but still must be paired with correct database grants/RLS.
- [ ] Keep any service-role/secret key exclusively in server-side secret storage. Never use a `VITE_` prefix for privileged secrets and never add the value to GitHub.
- [ ] Store local configuration in ignored `.env.local`; verify no real credentials are tracked in Git history or bundled into `dist`.

### B. Database and migrations
- [ ] Review the game enablement correction and all five migrations against a clean new project before applying them.
- [ ] Use the repository migration workflow and the Supabase CLI only after checking the installed version and `--help`; do not run guessed CLI commands.
- [ ] Apply migrations in sequence to the new development project, not to an unknown/existing database.
- [ ] Verify actual table/function grants and RLS; confirm every exposed user-data table has the intended policies.
- [ ] Check the Data API behavior for tables, functions and sequences under the new explicit-exposure defaults.
- [ ] Run Supabase Security Advisor after schema changes and resolve relevant high-severity findings.
- [ ] Generate database types from the real staging project and compare them with app-side types.
- [ ] Add the plugin registry schema and policy model as a separate reviewed migration; keep unapproved/disabled games non-launchable.

### C. Auth and email
- [ ] Set the project's Site URL and exact allowed redirect URLs for local development and, later, the real web origin.
- [ ] Enable email confirmation and test signup, confirmation, login, logout, expired sessions, password recovery and redirects.
- [ ] Set and verify the intended password policy and Auth rate limits; add bot protection if public signup requires it.
- [ ] Configure Google OAuth only after valid OAuth credentials and authorized redirect URLs are supplied. Keep the button disabled until this is complete.
- [ ] For public/production service, configure a trusted SMTP provider and verified sender/domain; do not rely on development/default SMTP throughput or branding.
- [ ] Add at least two disposable test accounts to verify account isolation and cross-member denial.

### D. Edge Functions and server secrets
- [ ] Review/deploy `member-self` to the development project; confirm it uses the caller's verified identity and preserves RLS.
- [ ] Keep `delete-account` disabled until its cleanup migration/function pass end-to-end tests using disposable accounts.
- [ ] Configure an exact `PLAYORA_ALLOWED_ORIGINS` list for development origins; no wildcard.
- [ ] Place server-only secrets in the project's Edge Function secrets. Never expose them in browser configuration.
- [ ] Test unauthenticated calls, invalid JWTs, expired/revoked sessions, forged member IDs, bad request bodies, CORS rejection and repeated/idempotent requests.

### E. Live security and release verification
- [ ] Run at least two real Auth accounts through positive and negative tests: Member A cannot read/write Member B's profile, preferences, favorites, wallet, ledger, matches, rooms, relationships, diagnostics or support reports.
- [ ] Confirm browser users cannot directly write balances, ledger entries, ratings, match winners, match state, deposit verification or audit events.
- [ ] Verify server-authoritative operations, replay/idempotency defenses, request limits, cancellation/retry paths and safe error messages.
- [ ] Run Security Advisor and review logs without storing tokens or personal secrets.
- [ ] Test backup/recovery expectations; understand Free-plan backup limitations before production.
- [ ] Keep the account-deletion flag, payments, deposits, paid entry and redeemable prizes disabled until their separate release gates are passed.

## 5. Current setup and remaining user actions

The development project has now been provisioned with owner approval and is accessible through the connected Supabase integration:
- Project: `playora-dev`
- Project reference: `nnowvfewtrfurnluhflt`
- Region: EU Central (`eu-central-1`)
- Plan: Free; recheck current billing/quotas before any production decision.
- The platform-only migrations have been applied and the latest trusted-origin/state-guard migration is present in the live migration history.
- The approved artifact-origin allowlist is empty, no plugin records exist, and all catalog games remain disabled.

No password, OAuth secret, service-role key, or other credential should be pasted into chat or committed. Remaining work is configuration and verification rather than project creation: review the three Security Advisor warnings for authenticated SECURITY DEFINER social RPCs; configure and test Auth redirects/providers; deploy only reviewed Edge Functions with server-only secrets (none are currently deployed); test the live Data API with two real members; review logs/advisors; reconcile migration history; and verify backup/recovery and hosting headers. Do not enable payments, deposits, paid entry or prize-bearing competitions.

## 6. Completion definition for Supabase

Supabase is not "complete" merely because a project exists or migrations apply. This workstream is complete for staging only when:
- project credentials and Auth settings are configured without exposed secrets;
- schema, explicit grants and RLS are reviewed and deployed through checked migrations;
- Edge Functions are deployed with narrowly scoped secrets/origins;
- the Data API behavior is tested under current defaults;
- two real test members pass isolation and privilege-denial tests;
- the Security Advisor and logs have been reviewed;
- typed app contracts and end-to-end browser tests pass against the actual project;
- known limitations and the production gate are documented.

Production readiness additionally needs a production project/environment, chosen hosting/domain, custom SMTP, backup/recovery, monitoring/alerts, load and abuse testing, security review and a cost/plan decision.

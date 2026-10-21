# Supabase Readiness Audit — Playora

- Audit date: 2026-10-22
- Status: account and repository checks completed; no live project exists in the connected Supabase account, so runtime configuration and production security cannot yet be tested.
- Repository: \`kamyarmohamadi/playora_app\`
- Source branch reviewed: \`feature/playora-neon-ui-member-isolation\`
- This document is a pre-provisioning audit, not a claim that Supabase is connected or production-ready.

## 1. Verified account status

| Item | Finding |
|---|---|
| Connected Supabase organizations | One visible organization: \`kamyarmohamade@gmail.com's Org\` |
| Organization subscription | Free |
| Projects returned by Supabase | None (\`projects: []\`) |
| Current project-creation cost quote in this Free organization | $0/month base quote |
| Project created by this audit | No |
| Migrations applied to a live project | No |
| Edge Functions deployed | No live project was available to query |

The $0/month quote is the current base quote from the connected Supabase cost tool for a project in the visible Free organization. It is not a promise of production capacity or a blanket guarantee against future plan changes, quotas, external-provider charges or paid add-ons. No project was created because the owner has not explicitly chosen the organization and approved provisioning.

Official billing reference: https://supabase.com/docs/guides/platform/billing-on-supabase  
Current plan reference: https://supabase.com/pricing

### Recommended first project

- Name: \`playora-dev\`
- Organization: the visible Free organization, only after the owner explicitly confirms that organization.
- Suggested region: \`eu-central-1\` (EU Central / Frankfurt) for an initial EU-based development environment, subject to the owner's data-residency decision.
- Purpose: disposable development/staging only; do not use real member data.
- Production: a separate project later, after feature scope, data residency, operating costs, backup requirements and deployment choices have been reviewed.

Supabase Free projects can pause after a period of low activity; the official billing documentation currently describes two active Free projects across eligible organizations. The Free project should therefore be treated as development/staging, not as a promise of always-on production availability. Review the live pricing/billing pages again before production.

## 2. Important upcoming Data API behavior

Supabase's official changelog states that automatic Data API exposure of new public-schema tables is being changed: the new default applied to newly created projects from 2026-05-30 and is enforced across all projects on **2026-10-30**.

References:
- Changelog: https://supabase.com/changelog?types=breaking-change
- Data API security guide: https://supabase.com/docs/guides/api/securing-your-api

This matters because database access has two separate layers:
1. Postgres grants decide whether a role can reach a table/function through the Data API.
2. RLS policies decide which rows the role can access.

RLS does not replace grants, and grants do not replace RLS. For new Playora tables and functions, the migration must explicitly grant only required permissions, enable RLS for exposed user-data tables, add appropriate policies, and restrict function execution. After provisioning, verify the actual behavior through the project's Data API instead of assuming that a successful SQL migration means the frontend can query a table.

Static inspection shows that the current core migration already contains explicit table grants/revokes and RLS for its listed tables, and the social migration explicitly locks down \`social_action_events\`. That is a useful foundation, but it is **not** yet proof against a real Supabase project's current defaults. Review every table/function grant and run live integration tests after applying migrations.

## 3. Repository-side migration audit

The existing repository contains these migrations, in this order:

1. \`supabase/migrations/20261020000000_secure_member_data.sql\`
2. \`supabase/migrations/20261020010000_private_rooms.sql\`
3. \`supabase/migrations/20261020020000_social_and_leaderboard.sql\`
4. \`supabase/migrations/20261020030000_limit_match_uuid_visibility.sql\`
5. \`supabase/migrations/20261020040000_account_deletion.sql\`

The first migration defines 18 public tables and enables RLS on them. The social migration adds \`social_action_events\`, enables RLS and revokes direct client-role access. The CI workflow applies all five migrations to disposable PostgreSQL 16 and runs SQL security, wallet, member-isolation, ranked Tic Tac Toe, room, social and account-deletion tests. A minimal Auth shim in CI is not a substitute for live Supabase Auth/JWT testing.

### Required correction before any live staging rollout

The initial migration contains:

\`update public.catalog_games set is_enabled = true where id = 'tictactoe';\`

That behavior conflicts with the newly approved delivery order: the platform must first become independent of all games, and games are to be packaged/added only after the platform acceptance gate. Before applying migrations to staging, change the registry semantics so no game is launchable by default. Do not expose ranked or private game sessions as ready until the generic plugin host, game package and server-authoritative implementation have independently passed their gates. Keep legacy engine code for later packaging; do not delete it.

### Required review of trusted SQL functions

Before a live deploy, review every function created or replaced in these migrations for:
- \`SECURITY DEFINER\` use only where necessary;
- a fixed, safe \`search_path\` and schema-qualified references;
- identity derived from a verified request/auth context, never trusted client-supplied user IDs;
- explicit \`REVOKE\` / \`GRANT EXECUTE\` for each callable function, including defaults inherited from \`PUBLIC\`;
- transactionality, idempotency, race conditions, rate limits and state-transition validation;
- no client route to edit wallet, ledger, match result, rating, deposit-verification, audit or privileged role data;
- no secrets in function responses or logs.

Some current function bodies call \`auth.role()\`. The current Supabase guidance warns against its use as an authorization predicate in RLS policies in favor of explicit policy roles. Do not perform a blind replacement in PL/pgSQL; review each function-level use against current documentation and cover the chosen identity/role check with tests.

### Other current source boundaries

- \`.env.example\` contains empty browser config values for the project URL and publishable/anon key; no service-role key is declared there.
- \`src/lib/supabase.ts\` fails closed when the project URL/key are missing.
- Account deletion is behind \`VITE_ACCOUNT_DELETION_ENABLED=false\` by default.
- Existing match/room RPCs are game-specific to Tic Tac Toe. They must be treated as legacy services, not as the generic plugin contract.
- There is not yet a plugin-registry/approved-artifact persistence model in the database.
- No audit of remote-host secrets, deployed Auth settings or actual database advisories is possible before a project exists.
- Real deposits, crypto confirmations, paid-entry tournaments and prize fulfillment remain disabled.

## 4. What must be configured after a development project exists

### A. Project and credentials
- [ ] Owner confirms the target organization and EU region before the project is created.
- [ ] Create \`playora-dev\`; retain the exact project reference/URL in the deployment record.
- [ ] Set a long, unique database password and store it in a password manager. Do not send it through ChatGPT or commit it.
- [ ] Retrieve only the project URL and publishable/anon key for browser configuration. These are designed for client use but still must be paired with correct database grants/RLS.
- [ ] Keep any service-role/secret key exclusively in server-side secret storage. Never use a \`VITE_\` prefix for privileged secrets and never add the value to GitHub.
- [ ] Store local configuration in ignored \`.env.local\`; verify no real credentials are tracked in Git history or bundled into \`dist\`.

### B. Database and migrations
- [ ] Review the game enablement correction and all five migrations against a clean new project before applying them.
- [ ] Use the repository migration workflow and the Supabase CLI only after checking the installed version and \`--help\`; do not run guessed CLI commands.
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
- [ ] Review/deploy \`member-self\` to the development project; confirm it uses the caller's verified identity and preserves RLS.
- [ ] Keep \`delete-account\` disabled until its cleanup migration/function pass end-to-end tests using disposable accounts.
- [ ] Configure an exact \`PLAYORA_ALLOWED_ORIGINS\` list for development origins; no wildcard.
- [ ] Place server-only secrets in the project's Edge Function secrets. Never expose them in browser configuration.
- [ ] Test unauthenticated calls, invalid JWTs, expired/revoked sessions, forged member IDs, bad request bodies, CORS rejection and repeated/idempotent requests.

### E. Live security and release verification
- [ ] Run at least two real Auth accounts through positive and negative tests: Member A cannot read/write Member B's profile, preferences, favorites, wallet, ledger, matches, rooms, relationships, diagnostics or support reports.
- [ ] Confirm browser users cannot directly write balances, ledger entries, ratings, match winners, match state, deposit verification or audit events.
- [ ] Verify server-authoritative operations, replay/idempotency defenses, request limits, cancellation/retry paths and safe error messages.
- [ ] Run Security Advisor and review logs without storing tokens or personal secrets.
- [ ] Test backup/recovery expectations; understand Free-plan backup limitations before production.
- [ ] Keep the account-deletion flag, payments, deposits, paid entry and redeemable prizes disabled until their separate release gates are passed.

## 5. User actions still needed

Only one immediate setup approval is required before the project can be provisioned:
1. Confirm whether the visible Free organization \`kamyarmohamade@gmail.com's Org\` is the organization to use for the development project. The current base quote for this organization is $0/month, and the recommended region is \`eu-central-1\`. Project provisioning has **not** been performed.

The owner should create/store the database password privately when the project is created. Do not paste passwords, OAuth client secrets or service-role keys into chat. If the owner chooses not to provision the project yet, development can continue against CI's disposable PostgreSQL database, but live Auth/RLS/Edge Function readiness must remain unverified and non-live.

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

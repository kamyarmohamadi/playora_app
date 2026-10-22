# Playora — Recovery and Continuation Guide

**Last verified:** 2026-10-22  
**Purpose:** Recover the repository and resume development after a lost session, device change, connector outage, or interrupted task. This file is the first place to read when resuming work.

## 1. Source of truth and safe recovery points

- **Private GitHub repository:** https://github.com/kamyarmohamadi/playora_app
- **Active development branch:** https://github.com/kamyarmohamadi/playora_app/tree/feature/playora-platform-game-plugin-architecture-2026-10-22
- **Original fallback snapshot:** https://github.com/kamyarmohamadi/playora_app/tree/checkpoint/playora-recovery-2026-10-22 (preserved historical checkpoint; do not develop on it)
- **Lifecycle-hardening snapshot:** https://github.com/kamyarmohamadi/playora_app/tree/checkpoint/playora-recovery-2026-10-22-session-hardening (read-only checkpoint before the browser-suite additions)
- **Latest Chromium E2E snapshot:** https://github.com/kamyarmohamadi/playora_app/tree/checkpoint/playora-recovery-2026-10-22-chromium-e2e (read-only snapshot for the current verified platform/runtime state)
- **Latest verified code/config commit:** `1759950a7d14a4bf2bb446903c7dee8ef7eb9dc5` (six Chromium E2E tests, separate Playwright TypeScript check, mobile Persian RTL overflow fix, and pinned browser-test dependencies).
- **Open draft PR:** https://github.com/kamyarmohamadi/playora_app/pull/7
- **Current project checkpoint:** https://github.com/kamyarmohamadi/playora_app/blob/feature/playora-platform-game-plugin-architecture-2026-10-22/docs/PROJECT_CHECKPOINT_2026-10-22.md
- **Architecture specification:** https://github.com/kamyarmohamadi/playora_app/blob/feature/playora-platform-game-plugin-architecture-2026-10-22/docs/superpowers/specs/2026-10-22-playora-platform-game-plugin-architecture.md
- **Overall roadmap:** https://github.com/kamyarmohamadi/playora_app/blob/feature/playora-platform-game-plugin-architecture-2026-10-22/docs/superpowers/plans/2026-10-22-playora-platform-completion-roadmap.md
- **Supabase setup audit:** https://github.com/kamyarmohamadi/playora_app/blob/feature/playora-platform-game-plugin-architecture-2026-10-22/docs/supabase/SUPABASE_READINESS_AUDIT_2026-10-22.md
- **Latest verified successful CI run:** https://github.com/kamyarmohamadi/playora_app/actions/runs/39699517781 (106 unit tests, six Chromium E2E tests, application and E2E type checks, import boundary, production build, PostgreSQL/RLS/security tests, and Deno checks all passed).

The `main` branch has not been used as the working branch for this architecture work. PR #7 is open and draft; do not merge it merely to recover files. PR #6 contains the separate admin preview and remains out of this workstream.

All source changes made through the connected GitHub workflow are committed to GitHub. The active branch and commit preserve the source tree, tests, migrations, docs and workflows. Files created only in a local editor or a temporary ChatGPT session would not be covered, so future changes must continue to be committed.

## 2. Clone and resume on another device

Install Git and a Node.js/npm version compatible with the repository's pinned Vite toolchain, sign in to the owner's GitHub account, then run:

```bash
git clone --branch feature/playora-platform-game-plugin-architecture-2026-10-22 --single-branch https://github.com/kamyarmohamadi/playora_app.git
cd playora_app
npm ci
npm test
npm run check:platform-boundary
npm run typecheck
npm run build
npm run typecheck:e2e
npm run test:e2e
```

To open the local development UI after configuring optional local environment values:

```bash
npm run dev
```

The local URL is printed by Vite. There is **no verified public Playora website/hosting URL yet**; do not treat the GitHub source links as a deployed app preview.

Use the active branch above for continued development. At the end of every meaningful change, commit the code and update this guide plus `docs/PROJECT_CHECKPOINT_2026-10-22.md`. Never work directly on `main`.

## 3. Supabase development project and live state

- **Project name:** `playora-dev`
- **Project reference:** `nnowvfewtrfurnluhflt`
- **Region:** EU Central, `eu-central-1`
- **Project dashboard:** https://supabase.com/dashboard/project/nnowvfewtrfurnluhflt
- **API URL:** https://nnowvfewtrfurnluhflt.supabase.co
- **Project status at last check:** `ACTIVE_HEALTHY`
- **Billing note:** the project had a $0/month base quote on the Free plan at creation. This is not a guarantee of always-on availability or future quotas/costs; recheck current billing before production use.

The live database was verified to have 8 visible catalogue metadata rows, 0 enabled catalogue games, 0 registered plugin versions, and 0 approved artifact origins. RLS is enabled on `catalog_games`, `game_plugin_versions`, and `game_plugin_artifact_origins`. Anonymous/authenticated browser roles cannot write plugin registry state or read the trusted origin approval table, and the legacy ranked Tic Tac Toe RPC remains unavailable to browser roles. This intentionally keeps the platform in a **no-games-enabled** state.

**Important live migration caveat:** the connected Supabase migration history contains 13 entries and includes repeated `plugin_registry_hardening` labels. The remote history and local file prefixes are not a perfectly clean one-to-one list. Before running `supabase db push`, linking a new checkout to this project, or trying to replay migrations, inspect both `supabase migration list` output and the actual remote migration history; reconcile the duplicate labels in a reviewed change. Do not blindly replay migrations against `playora-dev` or rewrite files that have already been applied.

### Supabase features not yet live

- The Supabase connector currently reports **zero deployed Edge Functions**. Function source code remains saved in this repository under `supabase/functions/`; it has not thereby become deployed or callable.
- Auth Site URL and exact redirect allowlist, email delivery/SMTP, Google OAuth provider credentials, and real two-user Auth/JWT browser tests have not been verified as complete.
- The project has no selected frontend hosting/domain or public release URL.
- No trusted game artifact hosting origin is approved. No game is launchable.
- Three Supabase Security Advisor warnings remain for authenticated execution of the social `SECURITY DEFINER` functions `list_social_relationships`, `send_friend_request`, and `respond_friend_request`. They are documented in the checkpoint and must receive independent review before production.

## 4. Environment variables, keys, and external connections

### Safe local configuration

The committed `.env.example` is a template with empty values. To configure a local development session, copy it to `.env.local` (the repository ignores `.env.local`) and use the current project URL plus a publishable/legacy anon key from the Supabase Dashboard:

- `VITE_SUPABASE_URL` — the development project's URL above.
- `VITE_SUPABASE_ANON_KEY` — the project's publishable or legacy anon key for browser use. It is not a service-role key; database security must still be enforced by grants/RLS.
- `VITE_PLAYORA_GAME_ARTIFACT_ORIGINS` — leave empty until the separately hosted artifact origin is reviewed and approved.
- `VITE_ACCOUNT_DELETION_ENABLED` — keep `false` until the server function and full deletion flow are deployed and tested.

Do not commit `.env.local` or any populated local environment file. The `.gitignore` already ignores `.env.*` except `.env.example`.

### Secrets and access that must not be stored in normal Git files

Never commit or paste into source files, a checkpoint, a pull request, a chat, or browser variables:
- database passwords;
- Supabase service-role/secret keys;
- Google OAuth client secrets;
- SMTP credentials;
- GitHub personal access tokens or connector OAuth tokens;
- wallet/private keys or seed phrases;
- access/refresh tokens or real member session data.

If/when Edge Functions are deployed, put the necessary server-only values into Supabase's Edge Function secret store (or the approved deployment secret store), with exact origin allowlists and the least privilege needed. Never use a `VITE_` prefix for a privileged secret. Add GitHub Actions secrets only when a reviewed deployment workflow actually needs them; CI currently runs automated checks and does not need a production secret to test local PostgreSQL fixtures.

The GitHub and Supabase account connections used by ChatGPT are **external account authorizations**, not repository files. They cannot be exported or restored by cloning GitHub. If a connector authorization is revoked or the work moves to a different ChatGPT account, the owner must reconnect the GitHub/Supabase integrations through their official sign-in flows. Keep control of the GitHub and Supabase owner accounts independently of this repository.

## 5. What is versioned vs. what lives outside GitHub

| Item | Source of truth / recovery |
|---|---|
| React/Vite app source, Game SDK, plugin host, manifest/message validation, tests and CSS | Committed on the active GitHub branch |
| SQL schema changes and plugin/RLS/grant rules | `supabase/migrations/` and SQL tests in the repository; compare with remote migration history before applying anything |
| Edge Function implementation | `supabase/functions/`; deployment status is separate, and currently none are deployed |
| npm dependency versions | `package.json` and `package-lock.json`; recover with `npm ci` |
| CI checks | `.github/workflows/ci.yml`; inspect the latest Actions run on the exact branch head |
| Project reference, API URL, recovery steps and outstanding setup | This guide, the Supabase audit and the project checkpoint |
| Local browser configuration | Owner-managed `.env.local`; intentionally not committed |
| Database/service/OAuth/SMTP secrets | Supabase Dashboard or dedicated secret manager; never plain Git files |
| Auth Site URL, provider configuration, SMTP sender, hosting/domain, DNS and deployed HTTP headers | External dashboard/hosting configuration; not all of these settings are represented in this repo |
| ChatGPT-to-GitHub/Supabase connector authorizations | Owner account authorization; not exportable through the repo |
| Live database schema | Applied migrations plus verified remote state; this does not replace a database backup if real data is later added |

No real game/user population has been launched in this project at the last check, but the live Supabase database and its settings are still external resources. GitHub is a recovery source for **the code and declared configuration**, not a copy of every credential, external dashboard setting, or cloud database backup.

## 6. Current work and exact next steps

The latest verified commit `1759950a7d14a4bf2bb446903c7dee8ef7eb9dc5` passed all three CI jobs in [run 39699517781](https://github.com/kamyarmohamadi/playora_app/actions/runs/39699517781): 106 Vitest tests across 16 files, the platform/game import-boundary check, application TypeScript and production build, dedicated Playwright TypeScript validation, six real-Chromium E2E tests, PostgreSQL RLS/wallet/plugin-registry security tests, and Deno Edge Function checks. The browser suite verifies an empty game registry, iframe sandbox and no-referrer behavior, inability to read the host document, denial of ungranted capabilities, nonce rotation on artifact version replacement, fail-closed unexpected navigation and malformed-message recovery, Persian RTL mobile navigation, and no horizontal overflow at 390 px. The mock artifact is a test fixture routed by Playwright; no public game artifact host or real game is enabled.

Next steps, in order:
1. Extend adversarial plugin lifecycle coverage for teardown during loading, repeated hostile messages, runtime revocation and keyboard/focus behavior; keep all browser fixture origins isolated and non-production.
2. Reconcile the live Supabase migration history (including duplicate `plugin_registry_hardening` labels) against the committed source before any Supabase CLI push/replay or database mutation. No blind migration replay.
3. Configure Auth redirect/provider settings only against a selected local/staging origin, deploy reviewed Edge Functions through a controlled process, and test with two disposable members for cross-member denial.
4. Independently review the three Security Advisor warnings for authenticated social `SECURITY DEFINER` RPCs before production.
5. Select hosting/domain, verify actual CSP/HTTP headers and a separate artifact origin, and build the trusted immutable-artifact release pipeline before approving any game.
6. Finish the platform-only release gates before creating or porting playable games. Keep the admin preview in PR #6 and keep games, payments, deposits and prize-bearing features disabled.

## 7. Rules for future continuation

- Start by reading this guide and `docs/PROJECT_CHECKPOINT_2026-10-22.md`.
- Fetch the active branch head and latest CI before editing.
- Use the saved architecture and implementation plans under `docs/superpowers/`; do not restart from scratch.
- Prefer small, test-first milestones and commit each verified change. If a test fails, save the failure details and fix the cause—do not weaken the test just to get a green run.
- Update the checkpoint with changed files, exact commit, test links, live service state, blockers and the next task.
- Never claim "zero bugs" or "production-ready" without the full relevant verification and release review.


## 8. Incremental checkpoint — plugin-host privacy and support intake

- Current code checkpoint before this documentation update: `058c1afb50402f1d2a8b91f4f2c854fd397bbea2` on the active architecture branch.
- Plugin host: added tests confirming the display alias is omitted from `host:init` unless `profile:read` is explicitly granted, and that unmounting clears the handshake timer and removes the message listener. The test was corrected to expect an empty capability list when the caller grants none; production code was not weakened.
- Support intake: added `supabase/migrations/20261026000000_support_reports.sql` and `supabase/tests/support_reports.sql`. The database schema enforces member ownership, column-scoped grants, own-row RLS, safe bounded diagnostics, idempotency keys and a maximum of five reports per member per hour. Tickets remain distinct; duplicate/root-cause grouping is intentionally a future privileged triage workflow.
- The first support-report SQL test caught an incorrect assertion that expected table-wide SELECT/INSERT privileges. The migration deliberately grants column-level access, so the test now verifies the intended column grants. The migration was not broadened to table-wide client permissions.
- Verification run for the current head: https://github.com/kamyarmohamadi/playora_app/actions/runs/39853259272 . At the last check, the Edge Function type checks, unit tests, and PostgreSQL security suite (including support-report tests) passed; Playwright Chromium installation/browser E2E was still in progress. Do not call the current head fully verified until every CI job completes successfully.
- Previously fully green baseline: https://github.com/kamyarmohamadi/playora_app/actions/runs/39699821911 for commit `ee525074840ef53bc8827a05060c2952524ecdd8`.

## 9. Resume after interruption

1. Fetch the latest branch head and CI status before editing; the branch may advance as new small commits land.
2. Read this guide and `docs/PROJECT_CHECKPOINT_2026-10-22.md`.
3. Keep `support_reports` member-owned: do not grant authenticated users update/delete or table-wide privileges, and never let client input choose owner/status/timestamps.
4. Do not apply the new support-report migration to the live development Supabase project until its migration-history ordering is reconciled and the migration is reviewed against the actual remote schema.
5. Continue with browser E2E completion, update the checkpoint, and commit each verified milestone.

# Playora — Recovery and Continuation Guide

**Last verified:** 2026-10-22  
**Purpose:** Recover the repository and resume development after a lost session, device change, connector outage, or interrupted task. This file is the first place to read when resuming work.

## 1. Source of truth and safe recovery points

- **Private GitHub repository:** https://github.com/kamyarmohamadi/playora_app
- **Active development branch:** https://github.com/kamyarmohamadi/playora_app/tree/feature/playora-platform-game-plugin-architecture-2026-10-22
- **Original fallback snapshot:** https://github.com/kamyarmohamadi/playora_app/tree/checkpoint/playora-recovery-2026-10-22 (preserved historical checkpoint; do not develop on it)
- **Latest lifecycle-hardening snapshot:** https://github.com/kamyarmohamadi/playora_app/tree/checkpoint/playora-recovery-2026-10-22-session-hardening (read-only recovery snapshot for the newest verified checkpoint)
- **Latest verified application-code commit:** `b3b32ea48d06af1ba4b7976e2f3948480f2dd2fb` (plugin session replacement/navigation guard and regression tests).
- **Open draft PR:** https://github.com/kamyarmohamadi/playora_app/pull/7
- **Current project checkpoint:** https://github.com/kamyarmohamadi/playora_app/blob/feature/playora-platform-game-plugin-architecture-2026-10-22/docs/PROJECT_CHECKPOINT_2026-10-22.md
- **Architecture specification:** https://github.com/kamyarmohamadi/playora_app/blob/feature/playora-platform-game-plugin-architecture-2026-10-22/docs/superpowers/specs/2026-10-22-playora-platform-game-plugin-architecture.md
- **Overall roadmap:** https://github.com/kamyarmohamadi/playora_app/blob/feature/playora-platform-game-plugin-architecture-2026-10-22/docs/superpowers/plans/2026-10-22-playora-platform-completion-roadmap.md
- **Supabase setup audit:** https://github.com/kamyarmohamadi/playora_app/blob/feature/playora-platform-game-plugin-architecture-2026-10-22/docs/supabase/SUPABASE_READINESS_AUDIT_2026-10-22.md
- **Latest verified successful CI run for that application-code commit:** https://github.com/kamyarmohamadi/playora_app/actions/runs/39697862076 (106 Vitest tests, typecheck/build, PostgreSQL security tests, and Deno checks all passed).

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

The latest verified application-code commit `b3b32ea48d06af1ba4b7976e2f3948480f2dd2fb` passed all three CI jobs in [run 39697862076](https://github.com/kamyarmohamadi/playora_app/actions/runs/39697862076): 106 unit tests, the import-boundary check, TypeScript, production build, PostgreSQL RLS/wallet/plugin registry tests, and Deno checks. The regression suite proves that replacing an artifact rotates the session identifier and rejects stale `plugin:ready` messages; a second document load in one session stops the frame. CI evidence does not substitute for browser E2E or a deployed site.

Next steps, in order:
1. Add and verify real-browser hostile-plugin tests for cross-origin messaging, teardown, repeated malformed messages, capability denial and mobile/RTL behavior; no Playwright suite is present yet.
2. Finish the platform-shell and accessibility audit while preserving the no-game state and keeping engine imports outside the host.
3. Reconcile the live migration history (including duplicate `plugin_registry_hardening` labels) before any Supabase CLI push/replay or further migration write.
4. Configure Auth redirects/providers only for an actual chosen local/staging origin; test with two disposable members and verify cross-member denial.
5. Review the three Security Advisor warnings, deploy a function only after its source and secrets/origins are reviewed, and test the real Data API.
6. Select hosting/domain, verify CSP/HTTP headers and the separate artifact host before approving any game.
7. Complete the platform-only release gates before creating or porting a playable game. Keep the admin preview in PR #6 and all games/real-money features disabled until their separate gates pass.

## 7. Rules for future continuation

- Start by reading this guide and `docs/PROJECT_CHECKPOINT_2026-10-22.md`.
- Fetch the active branch head and latest CI before editing.
- Use the saved architecture and implementation plans under `docs/superpowers/`; do not restart from scratch.
- Prefer small, test-first milestones and commit each verified change. If a test fails, save the failure details and fix the cause—do not weaken the test just to get a green run.
- Update the checkpoint with changed files, exact commit, test links, live service state, blockers and the next task.
- Never claim "zero bugs" or "production-ready" without the full relevant verification and release review.

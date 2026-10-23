# Playora Architecture Checkpoint — 2026-10-22

## Current objective
Finish the platform shell, backend/security contracts, catalogue, and isolated game runtime before implementing or porting any playable games. The platform must operate with zero enabled games. Adding/removing a game later should be a catalog/registry/package operation, not a conditional branch or game-engine import in platform core.

## Source of truth
- Private repository: https://github.com/kamyarmohamadi/playora_app
- Baseline branch: feature/playora-neon-ui-member-isolation at e5ab2b0d6c5bb82eb2685333e7e1c6743b25d7f3
- Active architecture branch: feature/playora-platform-game-plugin-architecture-2026-10-22
- Active draft PR #7: https://github.com/kamyarmohamadi/playora_app/pull/7
- Source-code head at the latest verified CI checkpoint before recovery-doc refresh: `d0ad10dcfb0049ecf97c955ae46afd75bfcf41da`
- Main remains untouched. PR #7 is open/draft and must not be merged until review gates are satisfied.
- Admin preview PR #6 remains separate and out of scope for this stage.

## Work completed and saved to GitHub

### Platform / Game SDK boundary
- Added a versioned packages/game-sdk manifest and message protocol contract.
- Added runtime manifest validation and plugin launch-policy checks for HTTPS, dedicated artifact origins, version-scoped paths, SHA-256 shape, SDK compatibility and capability allowlists.
- Added strict plugin-to-host message validation for exact iframe source, opaque-origin handling, per-session nonce, protocol version, message type, payload shape and message size.
- Added a generic GamePluginHost component. It uses an iframe with sandbox="allow-scripts" only, referrerPolicy="no-referrer", a per-session Web Crypto ID, a bounded startup handshake timeout, an accessible recovery state and no credentials passed into the game frame.
- The app's generic catalog click path now calls prepareGameLaunch and mounts GamePluginHost only when a visible catalog entry has an enabled, schema-valid registry record and explicit capabilities approved by the trusted registry. With the current empty registry, it shows the existing unavailable message and never creates a game iframe.
- Added a local artifact SHA-256 verifier that rejects digest mismatch, malformed expected digests, empty/oversized files, missing files and symlinks. This verifies bytes against a trusted expected digest; the release pipeline still needs to supply that digest from a trusted review/publish process.
- The host component is a platform runtime primitive, not a playable game. It is not a reason to enable any catalog entry or launch arbitrary URLs.
- Added tests for the launch policy, message validation, host sandboxing, denied origins and recoverable exit paths.
- Automated platform/game import-boundary check passes on the latest verified CI run.

### Supabase / registry
- Development project: playora-dev; project reference nnowvfewtrfurnluhflt; EU Central (eu-central-1).
- Applied and verified migrations include member isolation, private rooms, social/leaderboard, match identifier privacy, account deletion cleanup, platform-only game RPC lockdown, catalog/plugin registry, SDK-range hardening, trusted artifact-origin/state guards, catalog art metadata and separate explicit capability grants.
- Catalog display art is stored in catalog_games.art_key; the React provider reads this data instead of hardcoding a generic art key.
- Live verification: RLS enabled on catalog_games, game_plugin_versions and game_plugin_artifact_origins; browser roles cannot read or modify the approved-origin table.
- Current release gate is intentionally closed: 8 visible metadata rows, 0 enabled catalog games, 0 plugin registry rows, 0 approved artifact origins.
- Generated TypeScript database types were refreshed from the live development schema and committed.

### Verification
- Latest fully completed quality-gate run after launch-gate, capability-grant and artifact-verifier changes: https://github.com/kamyarmohamadi/playora_app/actions/runs/39691412875
- Result: all three jobs passed — 101 unit tests, TypeScript checks and production build; PostgreSQL RLS, wallet and plugin-registry tests; and Deno Edge Function type checks.
- This is CI evidence for the checked commit, not a claim that a production deployment or full browser end-to-end test has passed.
- Supabase Security Advisor reports three warnings for authenticated execution of list_social_relationships, send_friend_request and respond_friend_request. Review of the live function definitions found explicit auth.role()/auth.uid() checks and scoped relationship operations; the warnings remain documented for independent review before production.

## Remaining work before any game is enabled
1. Finish plugin-host lifecycle tests: hostile/replayed messages, capability request handling, timeout, navigation/exit, cleanup and session replacement.
2. Verify artifact integrity in a trusted release/build pipeline; the presence of a SHA-256 field alone does not verify downloaded bytes.
3. Finish a platform-wide audit of App.tsx to remove any remaining game-specific state, route or session assumptions from the platform shell.
4. Add real staging Auth/JWT integration tests using two separate members; confirm cross-member isolation and current Supabase Data API behavior.
5. Review the three Security Advisor warnings, Auth redirects/providers, server-only Edge Function secrets and operational logs.
6. Produce a browser preview from a real development build after a verified hosting/preview target exists. The current PR/code links are reviewable in a browser but are not a hosted app preview.
7. Complete threat-model and release checks for sandboxing, CSP, artifact hosting, revocation, rate limits, accessibility, monitoring, backups and recovery.

## Non-negotiable rules
- Do not implement or port playable games until the platform-only acceptance gate passes.
- Never execute game source in the platform React origin or load a user-supplied URL.
- Never pass Auth tokens, cookies, service-role keys, wallet data or privileged clients into an iframe.
- Game messages are untrusted intents; the server must remain authoritative for identity, matchmaking, room state, rewards, XP, rating, outcomes, deposits and staff permissions.
- The trusted artifact-origin allowlist stays empty until the hosting origin and artifact verification process are explicitly reviewed.
- Keep payments, crypto deposits, paid entry and prize-bearing competitions disabled.
- Save each meaningful change to this feature branch and update this checkpoint; do not rewrite from scratch or modify main.


## Implementation progress recorded after owner approval

### Platform/core and plugin launch
- Added a private npm workspace package `@playora/game-sdk` with versioned manifest/protocol types and strict runtime manifest validation.
- Added local and Supabase catalog adapters. The display-only catalog is independent of installed/launchable plugin records; backend artwork metadata is stored as a key, not game code.
- Removed platform-shell imports of the legacy Tic Tac Toe and Checkers engines and removed their ranked stats/leaderboard polling from the generic account-profile path. Legacy engine source/tests are preserved for later packaging.
- Added the source import-boundary checker to CI so platform code cannot directly import `src/games/*`.
- Added plugin launch-policy and message validation: exact descriptor keys, approved HTTPS origins, immutable game/version artifact path, digest, supported SDK version, session/source/message schema, and strict capability allowlists.
- Added the generic launch gate `src/platform/prepareGameLaunch.ts`. It revalidates the trusted registry manifest and requires granted capabilities to be a subset of both the manifest request and the host runtime allowlist.
- The platform UI is wired to request launch via this gate; when no enabled/compatible plugin exists it must fail closed and not mount an iframe.
- Added `GamePluginHost` with strict `sandbox="allow-scripts"`, no-referrer policy, host-controlled close/recovery and session handshake. The ready message is rejected before the host has entered its handshaking state.

### Supabase development project
- Project: `playora-dev`; ref `nnowvfewtrfurnluhflt`; region `eu-central-1`; Free-plan base project quote was $0/month at creation.
- Base security/data migrations, game-RPC lockdown, plugin registry, origin/state guards, artifact-origin index, catalog art metadata and the requested-vs-granted capability schema have been added/applied in the development project as recorded in the active migration history.
- Non-negotiable live state: every catalog game has `is_enabled=false`; no plugin is `enabled`; no artifact origin is approved; legacy Tic Tac Toe online RPCs remain revoked from browser roles.
- Generated TypeScript types are maintained from the actual development schema. Credentials, database passwords, service-role keys, and auth tokens are not stored in source control.

### Validation and current limitations
- CI includes unit tests, platform/game import boundary, TypeScript, production build, SQL RLS/wallet/plugin-registry checks, and Deno Edge Function validation. Use the latest run on the current branch head before declaring this checkpoint green.
- Real Supabase Auth/JWT two-account browser integration is not complete. Auth Site URL / exact redirects, custom SMTP, OAuth secrets, frontend hosting/origin, and the remote artifact host still require their own configuration and verification.
- The artifact-origin allowlist intentionally remains empty; no game should launch in development or production yet.
- Admin panel work is deferred and remains in its separate PR. No games have been ported or expanded during the platform-only milestone.

## Follow-up session checkpoint — generic launch integration
- Added `src/platform/prepareGameLaunch.ts`: launch is fail-closed and requires a trusted enabled registry record, manifest revalidation, ID match, supported SDK range, artifact-origin policy, SHA-256 metadata and explicit granted capabilities contained in both the manifest request and runtime allowlist.
- Connected the application game-card action to the generic launch gate and `GamePluginHost`; an empty/disabled registry must show the safe unavailable state and must not mount an iframe.
- The catalogue UI now reads display metadata via `gameCatalogProvider.listCatalog()` with a local metadata fallback only for offline/preview conditions. Cards are labelled upcoming until an approved plugin launches; legacy Tic Tac Toe/Checkers engine source remains preserved but outside the host application.
- Hardened `GamePluginHost` so `plugin:ready` is ignored until the host has started the expected handshake. Added a regression test for ready messages delivered before handshake.
- Added a platform-launch gate test suite for no plugin, disabled plugin, ID mismatch, untrusted artifact origin and requested-vs-granted capability mismatch.
- Runtime policy now permits an HTTP localhost host origin only for development while artifact URLs must still be HTTPS and on the explicit origin allowlist. `VITE_PLAYORA_GAME_ARTIFACT_ORIGINS` is intentionally empty by default; no artifact host has been approved.
- Supabase registry policy additionally requires `game_plugin_versions.state='enabled'` and a matching `catalog_games` record with `catalog_visible=true` and `is_enabled=true`. The current staging dataset keeps every game disabled.
- **Verification gate:** do not claim this milestone is green until the latest GitHub Actions run on the current branch head completes with all jobs passing. The newest integration changes were still being verified when this checkpoint was written.

## Current external setup blockers
- `playora-dev` exists and schema/migrations are being exercised, but Auth browser E2E is not verified with real test identities yet.
- The selected web hosting/domain is not configured. Consequently, Auth Site URL, exact redirect allowlist, production CSP/headers, trusted SMTP sender and the approved separate game-artifact origin still need to be configured against the actual hosting choice.
- No Google OAuth client secret, SMTP credential or service-role key has been committed or placed in chat. The connected Supabase actions expose project/migration/table/types/functions but not every Auth dashboard setting/secret-writing action.
- No game has been implemented or launched, and the admin panel is still deferred.


## Recovery audit — current verified status (2026-10-22)

This section and [docs/RECOVERY_AND_CONTINUATION.md](RECOVERY_AND_CONTINUATION.md) supersede any older setup statements in this checkpoint if they conflict.

- Private repo: https://github.com/kamyarmohamadi/playora_app
- Active branch: `feature/playora-platform-game-plugin-architecture-2026-10-22`
- Source-code head before this documentation refresh: `d0ad10dcfb0049ecf97c955ae46afd75bfcf41da`
- PR #7 is open/draft and remains unmerged: https://github.com/kamyarmohamadi/playora_app/pull/7
- Last verified CI run for that head passed: https://github.com/kamyarmohamadi/playora_app/actions/runs/39691688068
- Supabase dev project: `playora-dev`, `nnowvfewtrfurnluhflt`, `eu-central-1`; dashboard https://supabase.com/dashboard/project/nnowvfewtrfurnluhflt; API URL https://nnowvfewtrfurnluhflt.supabase.co
- Live database status: 8 visible catalog rows, 0 enabled games, 0 plugin versions, 0 approved origins, RLS enabled on catalog/registry tables; browser roles cannot write registry state or read trusted origin approvals.
- Supabase migration history has 13 entries and repeated `plugin_registry_hardening` labels; reconcile before running Supabase CLI migration pushes/replays.
- The connected project tool reports zero deployed Edge Functions. Function source remains in the repo, but this is not a live deployment.
- The three authenticated social SECURITY DEFINER warnings remain a documented production blocker. Auth redirects/provider setup, two-user live browser verification, hosting/domain, CSP, SMTP, artifact host and independent security review are not complete.
- Recovery/keys/connection instructions are in [docs/RECOVERY_AND_CONTINUATION.md](RECOVERY_AND_CONTINUATION.md). Do not store secrets in GitHub files or chat.
- The GitHub Actions run verifies code/SQL/Deno checks; it does not claim a hosted website or production-ready backend.


## Fixed recovery snapshot
A separate snapshot branch preserves the complete code/docs/migration tree recorded in the recovery guide: https://github.com/kamyarmohamadi/playora_app/tree/checkpoint/playora-recovery-2026-10-22. Use the active architecture branch for ongoing work; use the snapshot branch only to recover the exact saved state if a later change breaks the working tree.


## Session continuation checkpoint — 2026-10-22 (plugin lifecycle hardening)

### Verified source and CI
- Active development branch: `feature/playora-platform-game-plugin-architecture-2026-10-22`.
- Application/test commit: `b3b32ea48d06af1ba4b7976e2f3948480f2dd2fb`.
- Successful quality gate: https://github.com/kamyarmohamadi/playora_app/actions/runs/39697862076
- All three jobs passed: 106 Vitest tests (16 files), the platform/game import-boundary check, TypeScript/typecheck, production Vite build, PostgreSQL RLS/wallet/plugin registry tests, and Deno Edge Function source checks.
- PR #7 remains open and draft, not merged: https://github.com/kamyarmohamadi/playora_app/pull/7.

### Code change and red/green evidence
- Added a regression test that changes the immutable artifact version/URL/digest and sends `plugin:ready` using the previous session nonce.
- That test failed on commit `f97db67432bcd6753b7873b4354815fd2fa47c33`; CI showed 1 failed / 104 passed because the previous nonce was accepted after artifact replacement.
- Fixed in `767888886f2321126b39ff31c28b2985e1ba300e`: the host lifecycle now restarts for descriptor and runtime-policy changes, creates a fresh session ID and rejects stale messages. Run: https://github.com/kamyarmohamadi/playora_app/actions/runs/39697749758 (all jobs passed).
- Added a second test for a second iframe document load in one session. The host now fails closed with `unexpected_navigation`, invalidates the session ID and ignores messages after failure/exit.
- The combined test/code commit is verified in run `39697862076` (all jobs passed).

### Current boundaries and next exact work
- No games are launchable: 8 catalogue metadata rows, 0 enabled games, 0 registry versions, 0 approved artifact origins.
- No Supabase Edge Functions are deployed. Real Auth/JWT cross-member browser tests are still outstanding.
- Supabase migration history still has duplicate `plugin_registry_hardening` labels; do not run migration replay/push until the remote/source history is reconciled.
- Three Security Advisor warnings remain for authenticated social `SECURITY DEFINER` RPCs and are a production blocker pending security review.
- Next task: add real-browser Playwright tests for iframe navigation/message isolation, teardown and mobile/RTL, then reconcile migration history without reapplying migrations. Do not add a game, enable a plugin, deploy the admin panel, enable payments or merge PR #7.


## Session continuation checkpoint — 2026-10-22 (Chromium E2E, RTL and reproducible browser checks)

### Verified source and quality gate
- Active branch: `feature/playora-platform-game-plugin-architecture-2026-10-22`.
- Verified code/config head before this checkpoint update: `1759950a7d14a4bf2bb446903c7dee8ef7eb9dc5`.
- Successful CI run: https://github.com/kamyarmohamadi/playora_app/actions/runs/39699517781
- All three jobs passed: 106 Vitest tests across 16 files, platform/game import-boundary guard, app TypeScript, production Vite build, dedicated Playwright TypeScript check, six Chromium E2E tests, PostgreSQL RLS/wallet/plugin registry tests, and Deno Edge Function checks.
- Browser tooling is pinned: `@playwright/test` / `playwright` / `playwright-core` `1.64.1`; `@types/node` `22.20.2`; `undici-types` `6.21.0`. Run `npm ci`, `npm run typecheck:e2e`, and `npm run test:e2e` to reproduce. CI installs the pinned Playwright Chromium browser.

### Browser-covered behaviors
- Empty plugin registry: the catalogue remains visible as metadata, but no playable iframe is created.
- Isolated plugin: iframe uses `sandbox="allow-scripts"`, `referrerPolicy="no-referrer"`; fixture code cannot read `parent.document` and receives only explicit public presentation grants, not a profile alias or tokens.
- Hostile capabilities: an ungranted `wallet:write` request does not invoke a platform callback.
- Session identity: changing a versioned artifact rotates the session nonce; stale `plugin:ready` messages are rejected.
- Unexpected navigation and malformed messages stop the iframe and preserve the host's recovery/return path.
- At 390 px, Persian changes document language/direction to `fa`/`rtl`; navigation begins collapsed, opens/closes correctly, and page/header/main content has no horizontal overflow.
- A mobile regression test found 433 px of topbar content at 390 px; responsive spacing/search minimum width was fixed rather than weakening the test.

### Verified release boundaries and blockers
- No games are launchable: live Supabase dev state is still 8 catalogue metadata rows, 0 enabled games, 0 registered plugin versions, and 0 approved artifact origins.
- Browser E2E uses a Playwright-intercepted non-production fixture for `games.playora.example`; this does not mean a real game/artifact host or public Playora website exists.
- No Supabase Edge Functions are deployed. Real Auth/JWT two-account cross-member E2E, Auth redirect/provider configuration, hosting/domain/CSP, SMTP and the trusted artifact release pipeline are still outstanding.
- Supabase migration history has repeated `plugin_registry_hardening` labels. Reconcile source/remote history before any migration push/replay.
- Three Security Advisor warnings remain for authenticated social `SECURITY DEFINER` functions; production is blocked pending review.
- PR #7 remains open/draft and unmerged. Do not enable a game, payment/deposit/prize feature or admin panel as part of this milestone.


## Incremental security and support-intake checkpoint — 2026-10-23

- Latest code checkpoint before this documentation update: `058c1afb50402f1d2a8b91f4f2c854fd397bbea2`.
- Plugin-host tests now cover withholding display aliases unless `profile:read` is explicitly granted, plus listener/timer cleanup on unmount.
- Added the member-owned `support_reports` schema and disposable PostgreSQL test. Coverage includes column-scoped grants, own-row RLS for two members, immutable workflow fields from the client, safe diagnostics shape/size, idempotent submissions, and the five-per-hour rate limit.
- Current verification run: [39853259272](https://github.com/kamyarmohamadi/playora_app/actions/runs/39853259272). At the last check, unit tests, PostgreSQL security tests (including support reports), and Deno checks had passed; the Chromium install/browser E2E step was still running. This checkpoint does not claim all CI is green.
- A test-only permission assertion was corrected after CI showed the migration intentionally uses column-level grants rather than table-wide SELECT/INSERT. Do not broaden client grants to satisfy a table-level assertion.
- Support migration `20261026000000_support_reports.sql` was applied directly through the Supabase connector to `playora-dev` on 2026-10-22; remote migration version is `20261022210510`. Live two-identity transaction smoke test passed and rollback left zero support tickets. Do not bulk-replay migrations until the duplicate `plugin_registry_hardening` labels are reconciled. No playable games are enabled; the trusted plugin-origin allowlist remains empty.
- Next: confirm full CI completion, then continue browser-runtime lifecycle coverage and Auth/JWT integration planning.


## Verified support-report integration checkpoint — 2026-10-23

- Latest verified commit: `fff3c7badde09cf7467e32986f47abafe49b1ec2`.
- CI run [39855051815](https://github.com/kamyarmohamadi/playora_app/actions/runs/39855051815) passed all three jobs, including browser E2E.
- Added an accessible English/Persian support-report dialog to the platform shell, with sign-in gating, minimized diagnostics, field validation, recent ticket summaries and server-owned status display.
- Added a service adapter that scopes history and idempotency-retry lookup to the active member, rejects session changes, maps rate limiting to a safe message and recovers the original ticket after a duplicate idempotency response.
- The support backend is deliberately gated by `VITE_SUPPORT_REPORTS_ENABLED=false`. The migration is not applied to the live development project because its migration history requires reconciliation first.
- No playable games, approved artifact origins, payments or prize-bearing features are enabled. Keep PR #7 in Draft until the remaining platform security/release gates are reviewed.


## Current code checkpoint — support intake milestone (2026-10-23)

- Latest code head before this docs commit: `99182cd8989ea41eb2a1b8b46988f375ea5dc808`.
- Active work branch: [feature/playora-platform-game-plugin-architecture-2026-10-22](https://github.com/kamyarmohamadi/playora_app/tree/feature/playora-platform-game-plugin-architecture-2026-10-22); draft review PR [#7](https://github.com/kamyarmohamadi/playora_app/pull/7) remains open/unmerged.
- Support intake is wired into the platform footer through `SupportReportDialog` and the platform persistence adapter. Ticket inputs are allowlisted and normalized; diagnostics omit raw URLs, raw user-agent, cookies, tokens, stacks, private messages and local storage. The DB defaults owner to `auth.uid()`, keeps status/server fields client-unwritable, applies own-row RLS, enforces a five-ticket-per-hour limit and has a unique per-member idempotency key.
- Live support migration applied: remote history `20261022210510 / 20261026000000_support_reports`. Live transaction smoke test using two synthetic Auth identity claims passed: each member saw only its own ticket; transaction rollback left the table empty.
- The `VITE_SUPPORT_REPORTS_ENABLED` feature flag is intentionally false by default. No real sign-in/confirmation/recovery browser E2E has been completed using configured Supabase Auth and real test identities.
- CI run [39855320009](https://github.com/kamyarmohamadi/playora_app/actions/runs/39855320009): unit tests, import-boundary guard, type-check, production build, E2E type-check and PostgreSQL/RLS security tests are green; Playwright Chromium installation/browser E2E is in progress at the moment of writing. Recheck the live run and update this checkpoint before resting.
- Current hard blockers for release remain: three authenticated social `SECURITY DEFINER` Advisor warnings, no deployed Edge Functions, no real Auth/JWT two-account browser tests, no selected production domain/hosting/CSP/SMTP, and no external artifact host. No game/plugin is enabled.

## 2026-10-23 continuation — platform-shell modularization
- Extracted the complete bilingual English/Persian UI dictionary from `src/App.tsx` into `src/i18n/copy.ts`, exporting the shared `Locale` type. The English and Persian dictionaries were checked for key parity before this refactor (295 keys per locale).
- Added `src/i18n/copy.test.ts` to guard locale key parity and prevent empty translation values.
- This is a behavior-preserving refactor: no game engine, launch permission, route behavior, or Supabase policy was changed. CI must pass before treating this commit as verified.
- The work remains on the architecture branch and draft PR #7; `main` is untouched.


## Continuation checkpoint — plugin host lifecycle regression tests (2026-10-23)

- Work resumed from the architecture branch; `main` and the separate admin preview PR remain untouched.
- Added two regression tests in `src/plugin-host/GamePluginHost.test.tsx`:
  - Valid plugin resize messages are clamped to the host's safe iframe height range (320–900 px).
  - Replayed `plugin:exit` and telemetry messages after the host session ends cannot trigger a second exit or late telemetry callback.
- Saved test changes to the active GitHub branch:
  - Test additions commit: https://github.com/kamyarmohamadi/playora_app/commit/57feee2debf15ce710246616bd3fcd669cc45107
  - Follow-up test-helper cleanup: https://github.com/kamyarmohamadi/playora_app/commit/70e7b6a394c9dc842d83c86ba2b905ed2b8626e1
- These are new tests, not a verified pass yet. The previously successful CI run does not cover these new commits. Re-check GitHub Actions on the latest branch head before declaring this checkpoint green.
- No live Supabase schema, credentials, Auth configuration, production deployment, game registry, or enabled-game state was changed in this step.
- Next exact task: review the current workflow dependency pins and CI permissions, then continue the artifact provenance/release pipeline and real two-member staging Auth/RLS verification. Keep the plugin artifact-origin allowlist empty and all games disabled.


## Continuation checkpoint — CI least-privilege hardening (2026-10-23)

- Hardened `.github/workflows/ci.yml` with explicit workflow-level `permissions: contents: read`; CI jobs no longer inherit broader default repository-token permissions.
- Commit: https://github.com/kamyarmohamadi/playora_app/commit/48d1e3a60f3dd18c74f2fbd9d4b3c3bcd8fc7f82
- Plugin-host test coverage added in this session remains: resize clamp boundaries and rejection of replayed exit/telemetry messages after session end.
- Verification caveat: the connected GitHub Actions interface returned no workflow run or status for the new commits, so these latest test/workflow changes are **not yet CI-verified**. Do not treat previous green runs as covering these commits.
- The change is limited to the active feature branch. `main` and admin PR #6 remain untouched; PR #7 remains draft/unmerged.
- No live Supabase settings/migrations, credentials, artifact allowlist, or game-enabled state were changed.
- Next: obtain a CI run for the current branch head; then continue trusted artifact provenance/release verification and review the three live Supabase social-function Advisor warnings before any staging expansion.


## Session continuation checkpoint — 2026-10-23 (plugin host CI verified)

### Verified latest quality gate
- Verified GitHub Actions run #733: https://github.com/kamyarmohamadi/playora_app/actions/runs/39869596269
- Exact tested head: `0e1b4dafba1fc79fc6bfbc531a4c2b82931e5d65` on `feature/playora-platform-game-plugin-architecture-2026-10-22`, PR #7.
- All three jobs passed: unit tests, type checks, production build, platform/game boundary, Playwright Chromium E2E; PostgreSQL RLS/wallet/registry/support/private-room/social/account-deletion tests; Deno Edge Function type checks.
- This run includes plugin-host regression tests for iframe resize clamping (320–900 px) and ignoring replayed exit/telemetry messages after host exit, plus workflow-level `permissions: contents: read`.
- Corrected continuation record: [docs/RECOVERY_AND_CONTINUATION.md](RECOVERY_AND_CONTINUATION.md).

### Remaining release gates — unchanged
- No game is enabled; the trusted artifact-origin allowlist remains empty. Do not implement/enable a playable game until the platform-only acceptance gate is complete.
- Real Supabase Auth/JWT two-member browser integration remains outstanding.
- Reconcile duplicate Supabase migration-history labels before any migration replay/push; do not alter live project settings as part of this checkpoint.
- Review the three authenticated social `SECURITY DEFINER` warnings with an independent security review before production.
- Trusted artifact build/provenance/revocation, hosting/domain, Auth redirects, CSP/headers, Edge Function deployment verification, monitoring/backups and browser preview remain open.
- No secrets were added; no deployment, live Supabase configuration, payments or game enablement changed.


## 2026-10-23 continuation — release checklist and telemetry rate limit

- Added the comprehensive Persian release-readiness checklist: [docs/PLAYORA_RELEASE_READINESS_CHECKLIST_FA.md](PLAYORA_RELEASE_READINESS_CHECKLIST_FA.md). It covers frontend, backend/API, identity and member isolation, plugin runtime, security, games/rooms, wallet/payments, admin, installation/release and operations. Items are checked only with evidence; it explicitly documents current release blockers.
- Latest coding change: plugin telemetry forwarding is limited to 30 events per 60-second session window. Additional telemetry is dropped; session lifecycle, gameplay messages and the UI are not modified by this cap.
- Added a regression test sending 35 telemetry messages and asserting that only 30 reach the platform callback. Code/test commits: [ec8623b](https://github.com/kamyarmohamadi/playora_app/commit/ec8623b3224d01e360282b5a5220ce89036c6f6d) and [744ab5e](https://github.com/kamyarmohamadi/playora_app/commit/744ab5e5c420bc23baaf0179caaf208cccfe4c55).
- Verification status for the new telemetry cap: pending CI on the exact test commit; do not mark it green until the test/type/build/browser jobs complete successfully.
- The latest previously verified runtime checkpoint remains commit `da97be30946b9646c53afc033cf9130cbbeb6128`, with all three CI jobs passing: https://github.com/kamyarmohamadi/playora_app/actions/runs/39870334277.
- No game was enabled, no secret was added, and no live Supabase migration/configuration or deployment was changed. PR #7 remains draft/unmerged and `main` remains untouched.


## Scalability requirement added — 2026-10-23
- User requirement: plan Playora for growth to 100,000 members, including burst traffic when many users click the same feature and concurrent online gameplay.
- Added `docs/SCALABILITY_AND_LOAD_TEST_PLAN_FA.md` with capacity architecture principles, stress/spike/soak scenarios, initial latency/error targets, data-integrity checks and explicit rule that capacity is not claimed until measured.
- Added capacity gates to `docs/PLAYORA_RELEASE_READINESS_CHECKLIST_FA.md`. Only the plan/documentation item is checked; no load-test evidence exists yet, so 100,000 concurrent sessions are **not yet verified**.
- Architecture priorities: stateless/scalable API, protected pooled database connections, query/index profiling, idempotency, layered rate limits, backpressure, controlled async queues, realtime channel authorization/fan-out testing, and security/RLS verification under load.
- Keep game catalog disabled and do not change `main` or live Supabase as part of this documentation step.


## Load-test harness added — 2026-10-23
- Added `load-tests/catalog-read.js` and `load-tests/README.md` on the active development branch.
- The k6 script exercises the same public `catalog_games` read query used by the frontend provider, with staged ramp-up, latency/error thresholds, and a safety guard requiring `LOAD_TEST_CONFIRM=staging`.
- It requires only the staging publishable/anon key and never a service-role key. Do not run against production or shared environments without an approved window and cost review.
- This is only the first read-only workload. It does not validate authenticated member flows, game rooms, realtime fan-out, writes, or 100,000 concurrent users. The harness has not yet been executed on staging, so no capacity claim is made.
- Related plan: `docs/SCALABILITY_AND_LOAD_TEST_PLAN_FA.md`. Main remains untouched; no live Supabase configuration or enabled games were changed.


## Database capacity hardening — 2026-10-23
- Added `supabase/migrations/20261027000000_capacity_query_indexes.sql` with targeted indexes for sender-side social relationship lookups and open-room expiry/host queries.
- Added `supabase/tests/capacity_indexes.sql` and updated `.github/workflows/ci.yml` to apply the migration and verify the new indexes are valid/ready in disposable PostgreSQL CI. Updated `supabase/README.md` with the migration/test references.
- Initial GitHub Actions runs for the new commits failed in all three jobs before any step was reported (zero steps/runner ID); this is not enough evidence to diagnose a code failure or pass. The new migration/index test remains unverified until a run actually executes steps successfully.
- The capacity checklist explicitly leaves this item unchecked. No live Supabase migration was run, no games were enabled, and `main` remains untouched.


## Free-first product scope and master checklist — 2026-10-23
- Added `docs/PLAYORA_PRODUCT_REQUIREMENTS_AND_MASTER_CHECKLIST_FA.md` as the source for product decisions and end-to-end delivery gates across product/design, frontend, backend/database, API, authentication, realtime games, crypto/wallet, security/privacy, QA, deployment/cost, and future admin panel.
- Recorded the first-stage target as a few hundred registered accounts on free tiers where feasible; this is not a concurrency guarantee. Any provider quota, sleep/inactivity behavior, data retention, realtime limit, or upgrade trigger must be checked before inviting members.
- Recorded Google OAuth, English/Persian, module isolation, future upgrade path, private owner identity in public UI, proposed 100 coins per USD calculation, and configurable future crypto/network choices.
- Real-money betting, purchasable/redeemable coin wagering, crypto withdrawals and fee collection remain disabled pending jurisdiction/legal review, provider eligibility, KYC/AML/sanctions review, secure ledger, reconciliation, and explicit owner approval. Self-declared age 18+ alone is not sufficient.
- Updated k6 pilot profile to default to 100 VUs and reject more than 500 VUs; documentation recommends starting with 10–50 and increasing in stages against isolated staging only. This still tests catalog reads only.
- CI for recent commits is still failing before job steps are executed. No claim of passing CI, verified capacity, completed deployment, or ready-for-money operations is made.
- No live Supabase migration was run, no game was enabled, and `main` remains untouched.


## CI recovery attempt — 2026-10-23 (latest status)
- Inspected the latest run for commit `350f5d551d1d77b26ec6c00d170bc82f7278b9fe`: [GitHub Actions run 39876630159](https://github.com/kamyarmohamadi/playora_app/actions/runs/39876630159).
- All three jobs were marked failed with `steps: null` and `logs_url: null`; no workflow command output was available. This does **not** establish that the source code or SQL tests failed, and it does not establish that they passed.
- Triggered GitHub's supported "re-run failed jobs" operation. Attempt 2 was accepted, but the jobs again transitioned to failure without step summaries or logs. The runner/infrastructure/account-side cause remains undiagnosed from the available evidence.
- The workflow YAML was inspected: jobs use `ubuntu-latest`; the workflow-level token permission is `contents: read`. No obvious source-code test error can be inferred from the missing job steps.
- The capacity index migration and `supabase/tests/capacity_indexes.sql` were inspected in the repository. They have **not** been validated by a successful CI run or applied to live Supabase.
- Next action: resolve GitHub Actions job-start/log availability (including checking repository Actions settings/runner availability in the GitHub UI if connector access cannot reveal it), then run the full quality gate. Do not disable tests, mark checklist items complete, or push the migration to live Supabase to bypass this blocker.
- No code migration was applied to live Supabase, no games/payments were enabled, PR #7 remains draft, and `main` remains untouched.


## Follow-up — runner diagnosis and live Supabase security review (2026-10-23)
- Inspected the raw GitHub Actions jobs API for run [39876812027](https://github.com/kamyarmohamadi/playora_app/actions/runs/39876812027), not just the normalized job summary. All three jobs report `runner_id: 0`, empty `runner_name`, `steps: []`, and a completion interval of roughly 1–2 seconds. This strongly indicates the jobs did not reach a runner; there is no source-level test log to diagnose. The exact account/repository-side cause is still unknown because the connected API surface did not expose Actions settings/runner diagnostics.
- Workflow source was checked: it has `push` and `pull_request` triggers, `ubuntu-latest` runners, and least-privilege `permissions: contents: read`. Do not weaken permissions or remove test jobs as a workaround.
- Read-only Supabase inspection confirmed project `playora-dev` is `ACTIVE_HEALTHY`. Remote migration history has 14 entries; it still includes two `plugin_registry_hardening` labels and does not show the new capacity-index migration. No migration was pushed/applied during this review.
- Re-ran the live Security Advisor. It reports three authenticated `SECURITY DEFINER` RPC warnings: `list_social_relationships`, `send_friend_request`, and `respond_friend_request`. Read-only inspection of function definitions and ACLs found explicit user-ID/ownership checks, an empty search_path, and no observed PUBLIC/anon execute grant; the functions remain privileged API entry points and require independent review plus real two-member JWT tests.
- Added [docs/SECURITY_REVIEW_SOCIAL_RPCS_FA.md](SECURITY_REVIEW_SOCIAL_RPCS_FA.md), recording evidence, function-specific risks, safe remediation options, and release gates. This is a review document, not a claim that the warnings are fixed.
- Next: obtain owner-visible GitHub Actions settings/runner or billing/usage diagnostics, then restore actual CI execution. After that, test migration + capacity indexes in disposable PostgreSQL, reconcile migration history without replaying live migrations, and create real two-user staging Auth/JWT tests.
- No live schema or auth configuration changed; no game, crypto, payments or withdrawal feature enabled; PR #7 remains draft/unmerged and `main` remains untouched.


## CI recovery continuation — manual trigger and owner diagnostics (2026-10-23)
- Added `workflow_dispatch` to `.github/workflows/ci.yml` so the quality gate can be manually triggered after the repository/runner issue is corrected. Commit: [6bc3c32](https://github.com/kamyarmohamadi/playora_app/commit/6bc3c32171c33c47c9feae2cb9f48fdb0d9fb09a).
- The new push run [39877067881](https://github.com/kamyarmohamadi/playora_app/actions/runs/39877067881) failed in the same pre-step pattern. The jobs API still reports no steps/logs and runner ID 0. The manual trigger is an operational convenience, not a fix for runner allocation.
- Added [docs/GITHUB_ACTIONS_RUNNER_RECOVERY_FA.md](GITHUB_ACTIONS_RUNNER_RECOVERY_FA.md) with the exact observed evidence and owner-visible UI checks for Actions policy, runner availability, account usage/limits and a repeatable post-fix validation.
- This is the point at which the connected GitHub interface reaches its limit: the available actions cannot read the repository's Actions settings/usage pages or dispatch a workflow manually. Owner-visible settings/support investigation is required to identify the underlying reason. Do not infer billing exhaustion or a GitHub outage without evidence.
- No source tests were removed or weakened; no permissions were broadened. No live Supabase DDL, OAuth/Auth settings, games, payments, or withdrawals changed. PR #7 remains draft/unmerged and `main` remains untouched.

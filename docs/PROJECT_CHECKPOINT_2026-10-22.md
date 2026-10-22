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

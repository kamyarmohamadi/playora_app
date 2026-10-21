# Playora Architecture Checkpoint — 2026-10-22

## Current objective
Finish the platform shell, backend/security contracts, catalogue, and isolated game runtime before implementing or porting any playable games. The platform must operate with zero enabled games. Adding/removing a game later should be a catalog/registry/package operation, not a conditional branch or game-engine import in platform core.

## Source of truth
- Private repository: https://github.com/kamyarmohamadi/playora_app
- Baseline branch: feature/playora-neon-ui-member-isolation at e5ab2b0d6c5bb82eb2685333e7e1c6743b25d7f3
- Active architecture branch: feature/playora-platform-game-plugin-architecture-2026-10-22
- Active draft PR #7: https://github.com/kamyarmohamadi/playora_app/pull/7
- Latest saved checkpoint commit before this update: fa02cfde769f81d20a42d82d135de8474566cc33
- Main remains untouched. PR #7 is open/draft and must not be merged until review gates are satisfied.
- Admin preview PR #6 remains separate and out of scope for this stage.

## Work completed and saved to GitHub

### Platform / Game SDK boundary
- Added a versioned packages/game-sdk manifest and message protocol contract.
- Added runtime manifest validation and plugin launch-policy checks for HTTPS, dedicated artifact origins, version-scoped paths, SHA-256 shape, SDK compatibility and capability allowlists.
- Added strict plugin-to-host message validation for exact iframe source, opaque-origin handling, per-session nonce, protocol version, message type, payload shape and message size.
- Added a generic GamePluginHost component. It uses an iframe with sandbox="allow-scripts" only, referrerPolicy="no-referrer", a per-session Web Crypto ID, a bounded startup handshake timeout, an accessible recovery state and no credentials passed into the game frame.
- The host component is a platform runtime primitive, not a playable game. It is not a reason to enable any catalog entry or launch arbitrary URLs.
- Added tests for the launch policy, message validation, host sandboxing, denied origins and recoverable exit paths.
- Automated platform/game import-boundary check passes on the latest verified CI run.

### Supabase / registry
- Development project: playora-dev; project reference nnowvfewtrfurnluhflt; EU Central (eu-central-1).
- Applied and verified migrations include member isolation, private rooms, social/leaderboard, match identifier privacy, account deletion cleanup, platform-only game RPC lockdown, catalog/plugin registry, SDK-range hardening, trusted artifact-origin/state guards and catalog art metadata.
- Catalog display art is stored in catalog_games.art_key; the React provider reads this data instead of hardcoding a generic art key.
- Live verification: RLS enabled on catalog_games, game_plugin_versions and game_plugin_artifact_origins; browser roles cannot read or modify the approved-origin table.
- Current release gate is intentionally closed: 8 visible metadata rows, 0 enabled catalog games, 0 plugin registry rows, 0 approved artifact origins.
- Generated TypeScript database types were refreshed from the live development schema and committed.

### Verification
- Latest fully completed quality-gate run after the stale-session test correction: https://github.com/kamyarmohamadi/playora_app/actions/runs/39689678077
- Result: all three jobs passed — unit tests/typecheck/production build, PostgreSQL RLS and wallet privilege tests, and Deno Edge Function type checks. The host suite passed 87 tests total across the unit-test run.
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

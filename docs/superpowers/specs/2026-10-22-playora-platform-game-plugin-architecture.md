# Playora Platform–Game Plugin Architecture

- Date: 2026-10-22
- Status: Proposed architecture; awaiting owner review
- Source baseline: `feature/playora-neon-ui-member-isolation` at `e5ab2b0d6c5bb82eb2685333e7e1c6743b25d7f3`
- Scope: decouple the Playora platform from game-specific code before implementing or porting more games.

## 1. Product intent

Playora is the platform; games are independent extensions. The platform must remain usable and testable when zero games are installed. Adding, updating, disabling, or removing a game must not require edits to the platform shell or core source. A game may be added by publishing an independently versioned package/artifact and registering a validated manifest through the trusted game registry.

"Without changing core code" does not mean "without any change anywhere": publishing a game requires a new game package/build and a trusted registry/catalog entry. It must not require conditional branches or imports in the platform application.

The platform's final-release standard is evidence-based: no absolute zero-bug claim; required tests and operational gates must pass before a feature is marked ready.

## 2. Current-state evidence

At the source baseline:
- The project is a React + TypeScript + Vite application with npm lockfile and CI.
- `src/App.tsx` imports and invokes Tic Tac Toe and Checkers engines directly; it also has game-specific online match and private-room assumptions for Tic Tac Toe.
- `src/catalog/gameRegistry.ts` stores game metadata in a static manifest and maps icon/art values through app-owned allowlists.
- `src/games/tictactoe.ts` and `src/games/checkers.ts` contain independent engine functions, but the UI and app shell still own game-specific rendering and state.
- CI currently runs UI/unit tests, typecheck, Vite build, Postgres policy/game-invariant tests, and Deno checks. The latest observed run for the source head succeeded on 2026-10-20.
- No Supabase project is available in the connected account at the time of this design. Real Auth, production migrations, Edge Functions, live game/network integration and production monitoring therefore cannot be claimed as deployed or verified.
- The owner/admin preview remains in the separate draft PR #6 and is out of scope for this phase.

Source references:
- `src/App.tsx`
- `src/catalog/gameRegistry.ts`
- `src/games/tictactoe.ts`
- `src/games/checkers.ts`
- `docs/SECURITY_MODEL.md`
- `docs/PRODUCTION_READINESS.md`
- `supabase/README.md`

## 3. Design principles

1. **Platform independence:** no imports from any individual game package inside platform-shell/core modules.
2. **Zero-game operation:** app home, navigation, account/profile/preferences, catalogue, support entry points, social surfaces and settings must boot without game bundles installed or enabled.
3. **Plugin contract:** every game implements a versioned, typed contract; the host depends only on the contract.
4. **Independent release:** game engines, UI assets and build artifacts are versioned separately from the platform. Registry changes are data/configuration, not edits to platform source.
5. **Security boundary:** game code is untrusted. A separate folder, npm package, dynamic import, React component, or same-origin iframe is not a security sandbox.
6. **Server authority:** games can request actions, but may not authoritatively set identity, wallet balance, reward, XP, rating, match outcome, deposit status, or staff permissions.
7. **Deny by default:** plugins start with no privileged platform access. Each capability must be declared, reviewed, granted by the trusted host, and enforced server-side where relevant.
8. **Backward compatibility:** the platform advertises supported SDK/API versions and rejects incompatible or malformed manifests before loading a plugin.
9. **Recoverability:** a failing or incompatible game must be isolated so it cannot crash the host shell; disabling a plugin must immediately prevent new sessions and stop new launches.
10. **No false readiness:** catalog cards and demo UI must clearly distinguish installed, enabled, unavailable, and live features.

## 4. Recommended architecture

### 4.1 Platform core

Core owns:
- application shell, navigation, responsive design system, accessibility and locale switching (Persian RTL and English);
- sign-in/sign-up/recovery UI and the platform's trusted authentication integration;
- member profile, user preferences, favorites, social and support entry points;
- platform-level game catalogue, search, categories, featured metadata and launch UX;
- contracts/adapters for persistence, telemetry, notifications, matchmaking, private rooms and session lifecycle;
- safe error handling, capability grants, policy checks and feature status messaging.

Core does **not** own a game's rules engine, board/hand UI, game-specific state transitions, move legality, bot or game-specific rendering. Game-specific services must not be hard-coded in `App.tsx`.

### 4.2 Game SDK and contracts

Add a platform-owned, versioned module such as `packages/game-sdk` (final path may be adjusted after the implementation plan). It provides TypeScript types and runtime validators for:
- `GameManifest`: stable ID, semantic version, display metadata/locales, supported SDK range, artifact entry, player-count/mode declarations, asset references, required and optional capabilities, status and integrity metadata;
- lifecycle messages: host ready, game ready, start, pause/resume, leave, resize and error;
- input/output messages: schema-versioned and size-limited, with generated per-session nonce/correlation identifiers;
- result intents and session events. These are intents, not trusted outcomes; the server validates gameplay state and resolves ranked results.

A manifest is data only. It must reject unknown fields, duplicate/invalid IDs, oversized strings, unsupported API versions, unsafe URL schemes, unapproved hosts and capabilities beyond the allowlist. Never execute source or HTML provided inside a manifest.

### 4.3 Plugin registry and game catalogue

Separate three concepts:
- **Metadata/catalogue:** safe titles, descriptions, art keys, locales, categories, player counts and user-facing status.
- **Plugin registry:** trusted artifact reference, exact version, checksum or equivalent integrity value, SDK compatibility, approval state and rollout/disable status.
- **Session runtime:** launch a known approved version and end the session cleanly.

The host requests catalog data through a platform adapter. For development and offline preview, a validated local data fixture is permitted. Production registry writes must use a trusted administrative path, not arbitrary browser input. Never load plugins from user-submitted URLs. A game is unavailable unless its manifest and artifact pass verification and an authorized registry marks it approved/enabled.

Suggested states: `draft`, `review`, `approved`, `enabled`, `disabled`, `revoked`. State transitions and who may perform them must be enforced by the backend once the registry is live.

### 4.4 Runtime and isolation

Recommended initial runtime: a dedicated iframe for each game, with the strictest workable sandbox policy (initially only `allow-scripts`; do not add `allow-same-origin`, popups, forms, downloads or top-level navigation without a documented security review). Host the artifacts on a separate origin from the main platform where possible. Test the exact chosen hosting/CSP behavior before launch.

- Do not pass access/refresh tokens, cookies, service-role keys, private member data, wallet secrets or privileged RPC credentials into the iframe.
- Validate every message against a strict schema, SDK version, message size and allowed message type; bind it to the exact iframe `contentWindow` and current session nonce. An opaque sandbox may send `origin: null`; never treat that value alone as proof of identity.
- Do not accept the plugin's claimed score or result as authoritative. The host sends player intents to an approved game service; the trusted backend validates state and calculates outcomes.
- Capability grants are narrow and session-scoped. For example, display name and locale may be provided as minimised presentation context; ranked queue, private-room join and result submission are separate capabilities and remain backend-mediated.
- Plugin exceptions, hangs, bad messages, incompatible versions and failed artifact loads produce a recoverable in-host error state. Provide timeout, cancel/leave, telemetry redaction and a disable/revoke path.
- No remote executable code may be loaded directly into the main React app bundle.

Implementation must include a threat-model review for iframe sandbox flags, cross-origin messaging, CSP, asset hosting, supply-chain integrity and server endpoints before production launch.

### 4.5 Server-side game services

The platform exposes stable service contracts/adapters, not direct database clients to games. Authenticated and anonymous flows must be explicitly scoped. Ranked matching, private rooms, durable match state, rating/XP changes and future payments go through trusted backend APIs/RPCs with:
- verified identity derived server-side;
- authorization and state-transition validation on every request;
- idempotency/replay handling, rate limits and request-size limits;
- RLS policies and negative cross-member tests;
- immutable or compensating financial ledger operations;
- audit logging for privileged actions and secret redaction.

A local demo adapter is never a production authorization source. When Supabase is provisioned, run real JWT/Auth/RLS integration tests with at least two users before marking these flows live.

## 5. Proposed repository layout

This is a target layout, not a requirement to rename every file in one commit:

```text
src/
  app/                  # shell, routing, page composition
  platform/             # auth, profiles, preferences, support, social, services
  catalog/              # catalogue UI and registry adapter (metadata only)
  plugin-host/           # iframe launcher, session lifecycle, message validation
packages/
  game-sdk/              # versioned plugin contracts + schema tests
games/
  <game-id>/              # independently versioned game source and own tests
  manifests/              # trusted manifest fixtures/schemas for CI
supabase/
  migrations/
  functions/              # trusted server-side APIs
  tests/
docs/
  architecture/
  superpowers/specs/
```

Exact paths may adapt to the current React/Vite layout. Do not churn working files only to match this tree. Historical game engines must be preserved during extraction; no source is deleted unless the owner explicitly approves removal after migration and verification.

## 6. Scope boundaries

### In scope before new game implementations
- Establish and test the SDK/manifest/message contracts.
- Remove direct game-engine and game-UI imports from the platform shell.
- Move platform-specific account, catalog, social, room and persistence concerns behind explicit interfaces/adapters.
- Make the application boot and navigate with zero game bundles.
- Build the generic plugin catalogue/host lifecycle, unavailable/error/disabled states and a controlled demo manifest fixture.
- Preserve existing game logic as legacy source for later packaging/porting; do not expand game rules or implement another game during this milestone.
- Complete the platform flows (auth/profile/preferences/social/support and safe wallet/status UX) independently of game engines, with clear live/demo/unavailable states.
- Prepare Supabase migrations/functions and a staging-validation checklist. Do not provision a paid service or apply migrations to an unknown project without cost/target checks and approval.

### Out of scope until the platform gate is met
- Porting or implementing game rules, new boards, game bots or new game-specific UI.
- Treating mock local state as real Auth, multiplayer, wallet, payments or staff authorization.
- Enabling real-money deposits, paid tournaments or transferable/redeemable prizes.
- Integrating the standalone admin preview.
- Loading arbitrary third-party game URLs or permitting plugins to execute in the host origin.

## 7. Milestones and acceptance gates

### M0 — Architecture and baseline
- Approved written design and implementation plan saved in GitHub.
- Baseline CI and exact source head recorded; main untouched.
- Existing game logic and admin preview preserved.

### M1 — SDK/registry contract
- Unit tests validate manifests (valid/invalid IDs, duplicates, unknown fields, URL allowlist, version range, capability allowlist, length/size limits).
- Unit tests cover all permitted and forbidden host/plugin message types, invalid origin/source/session nonce, malformed payloads, oversized messages and stale sessions.
- Contract is versioned and has compatibility policy documented.
- Host source does not import an individual game's engine.

### M2 — Platform shell independent of games
- App boots and core navigation works with an empty plugin registry and no game bundle network requests.
- Search/category/favorites and safe game cards work without game-specific imports.
- Removing/adding a test manifest changes catalogue/availability without editing core components.
- All core UI shows correct loading, empty, error and disabled states; English and Persian RTL work on mobile/desktop.

### M3 — Secure plugin host
- Only approved/enabled, compatible manifests can launch.
- Each plugin runs in the reviewed isolated runtime; no direct host token/secret access.
- Malformed messages are ignored/rejected and logged safely; plugin crash/hang/timeout never crashes the shell.
- Disable/revoke prevents new launches; existing sessions terminate or move to a safe exit state.
- CSP and origin configuration are tested on the target staging host.

### M4 — Platform product completion
- Auth/account/profile/preferences/social/support flows have real end-to-end tests in the configured staging backend or are honestly marked unavailable until then.
- Members cannot access one another's private records; role and capability decisions are server-enforced.
- No fake wallet/deposit result can grant value; wallet and ranked outcome writes remain trusted-server-only.
- Accessibility, reduced motion, keyboard navigation, error recovery, responsive and RTL acceptance tests pass.

### M5 — Release readiness (platform only; no game feature gate)
- Clean install, unit/integration tests, typecheck, lint if added, production build and dependency/security scan pass on the exact release commit.
- Playwright journeys cover sign-up/sign-in/recovery where configured, navigation, empty catalogue, a controlled test plugin, plugin failure/recovery and desktop/mobile/RTL layouts.
- Browser console has no unhandled errors; required network requests and headers are inspected.
- Supabase real-project RLS/Auth tests run against staging with two test accounts, or all dependent capabilities remain explicitly non-live.
- Threat model, backup/restore, monitoring, secret scan, CSP and operational rollback are reviewed.
- A separate human security review is required before public launch.

### After M5
Implement each game as an independently versioned package against the frozen SDK. Each game's tests, code review, build and signed/verified artifact can ship separately. Do not modify the platform core just to add an individual game; if a game needs a new core capability, review it as a separate SDK/platform change with compatibility tests.

## 8. Quality workflow and persistence

For every meaningful task:
1. Update or create a scoped checkpoint before implementation, including branch, baseline commit, goal and acceptance criteria.
2. Work in an isolated feature branch; keep `main` and the admin preview branch untouched.
3. Use test-first development for contracts and behavior; run only commands that exist in `package.json`/CI and verify their output.
4. Run relevant tests, typecheck, production build and security checks before claiming success.
5. Commit incremental, reviewable milestones and keep this document/checkpoint current.
6. Open or update a draft PR against the current application feature branch. Do not merge until review/CI/acceptance gates pass.
7. Whenever the owner asks for status, provide links to the current checkpoint, PR, and, after UI changes, a browser preview or verifiable screenshots. If the actual browser preview cannot be verified, state that explicitly.
8. Never promise background work or claim "zero bugs"; report passed checks and remaining limitations precisely.

## 9. Open implementation decisions to resolve in the implementation plan

The plan must settle these without changing the product goal:
- Exact package/workspace strategy compatible with the current Vite/npm repository.
- Whether game manifests are initially checked into the private repository or published from a trusted server registry; prefer local fixtures for development and a server-backed registry only after backend setup.
- How separate-origin game assets will be hosted, versioned and integrity-checked.
- Which platform routes and server contracts remain in the first platform-only milestone.
- How existing Tic Tac Toe and Checkers code is preserved and retired from the platform runtime.
- Which Playwright/browser tooling is available in CI and what must be added (with pinned versions and a lockfile) versus documented as an external blocker.
- Staging Supabase creation, potential cost and configuration. No paid project is created without review of the quote and explicit approval.

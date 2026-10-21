# Playora Platform Core and Game SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this plan task-by-task after owner review. Track each task, run its tests, commit each reviewed milestone, and update the checkpoint before moving on.

**Goal:** Make the existing Playora platform independent of all game engines and define a stable, versioned Game SDK and data-only registry so the app boots and remains usable with zero game plugins installed.

**Architecture:** Keep the React/Vite platform as the host. Add a small npm-workspace package for the versioned manifest and message contracts, validate all catalog/manifest input at runtime, and make catalogue/UI state depend on a registry/provider interface rather than imports of game code. Preserve legacy Tic Tac Toe and Checkers source/tests, but remove their direct imports and game-specific state from platform components.

**Tech Stack:** Existing React 19, TypeScript 5.9, Vite 7, npm lockfile, Vitest, current GitHub Actions CI, Supabase/Postgres migrations as a later reviewed task. Browser E2E should use a pinned Playwright version only after verifying version/runtime compatibility.

**Spec:** `docs/superpowers/specs/2026-10-22-playora-platform-game-plugin-architecture.md`

## Global Constraints

- Do not modify `main`; work only on the reviewed feature branch and use a reviewable PR.
- No file under the platform app may import a specific game's engine or React view.
- Do not delete legacy game code or tests; keep them out of the platform runtime until their later packaging phase.
- No `eval`, `Function` constructors, `dangerouslySetInnerHTML`, untrusted remote script injection, or arbitrary game URLs.
- Treat plugin manifests, catalog data, message payloads, and client state as untrusted input.
- Keep English as the selected default language and preserve complete Persian RTL support.
- No game engine implementation/porting is included in this plan.
- No account secret, Supabase service-role key, database password, OAuth secret, wallet key, or auth token may be committed or passed into a plugin.
- Deposits, paid entry, crypto, prize-bearing tournaments, transferable rewards and account deletion stay disabled until their own reviewed gates pass.
- A feature is not "ready" until the relevant automated tests and checks pass on the exact branch/commit; never claim zero bugs.

## Review Focus

- **Empty registry:** the app must still boot and core navigation must work when the plugin list is empty.
- **Malformed manifest:** invalid/duplicate identifiers, unknown fields, unsupported versions, unsafe URL schemes/hosts, oversized text/payloads, and excessive capabilities must be rejected before rendering/launch.
- **Legacy dependency leak:** any platform import of a game engine or game-specific view must fail an architecture test.
- **Unavailable backend:** missing URL/key, API failure, stale session or empty response must result in explicit safe states, not fake success or broken navigation.
- **Locale and viewport boundaries:** English, Persian/RTL, mixed-direction identifiers, keyboard navigation and narrow mobile layouts must remain functional after removing game modals.

---

### Task 1: Record and verify the source baseline

**Files:**
- Read: `AGENTS.md`, `docs/ENGINEERING_BASELINE.md`, `.agents/skills/playora-engineering/SKILL.md`
- Read: `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.app.json`, `.github/workflows/ci.yml`
- Update: `docs/PROJECT_CHECKPOINT_2026-10-22.md`

- [ ] Confirm the current branch starts from the approved baseline commit `e5ab2b0d6c5bb82eb2685333e7e1c6743b25d7f3`; record the new plan branch/head SHA in the checkpoint.
- [ ] Run `npm ci`.
- [ ] Run `npm test`; expected result: all existing Vitest tests pass before behavior changes.
- [ ] Run `npm run typecheck`; expected result: no TypeScript errors.
- [ ] Run `npm run build`; expected result: Vite production build completes.
- [ ] Run `npm audit --audit-level=moderate`; investigate any finding rather than applying broad automatic upgrades.
- [ ] Commit only the refreshed checkpoint and observed baseline results. If any baseline command fails, preserve the output and fix/resolve the baseline before structural edits.

### Task 2: Add the versioned Game SDK workspace

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `packages/game-sdk/package.json`
- Create: `packages/game-sdk/tsconfig.json`
- Create: `packages/game-sdk/src/index.ts`
- Create: `packages/game-sdk/src/manifest.ts`
- Create: `packages/game-sdk/src/protocol.ts`
- Test: `packages/game-sdk/src/manifest.test.ts`
- Test: `packages/game-sdk/src/protocol.test.ts`

**Interfaces:**
- Export `GameManifestV1`, `PluginCapability`, `PluginMessageV1`, `PluginHostMessageV1`, `PluginGameMessageV1`, `SdkCompatibilityRange`, `PluginRegistryState`, `PluginRegistryRecord`, `ApprovedPluginRecord`, and `ApprovedPluginDescriptor` from `@playora/game-sdk`.
- `PluginRegistryState` is exactly `"draft" | "review" | "approved" | "enabled" | "disabled" | "revoked"`. `PluginRegistryRecord` is a validated manifest plus trusted registry state. `ApprovedPluginRecord` narrows the registry state to `"enabled"` and includes the trusted launch descriptor. `ApprovedPluginDescriptor` contains only `gameId`, `version`, absolute `entrypointUrl`, `artifactSha256`, supported `sdkVersion`, and granted capabilities.
- A plugin package manifest contains data only; it does not contain executable code, HTML, imports, permission implementation or arbitrary URLs.
- Registry approval/enablement state belongs to trusted registry records, not to the plugin-authored manifest.

- [ ] Write failing type/contract tests before defining implementation types. Tests must require a stable game ID, semantic version, bilingual display metadata, category/player range, SDK compatibility range, artifact entrypoint, artifact digest, and a declared capability list.
- [ ] Add the npm workspace without changing existing public app behavior. Keep the workspace package private to the repository until a separate publication strategy is reviewed.
- [ ] Define `GameManifestV1` with `manifestVersion: 1`; IDs must match `^[a-z0-9_-]{2,40}$`; titles/descriptions use explicit `en` and `fa` records; artifact metadata identifies an immutable versioned artifact.
- [ ] Define the initial explicit capability union. Default capability set is empty; all capability use is host-granted and server-authorized where it touches protected operations.
- [ ] Define the message protocol with protocol version, per-session nonce/correlation value, message type, request ID where applicable, and bounded payload.
- [ ] Configure a package-level TypeScript check and make the root typecheck include it.
- [ ] Run the focused SDK tests, then `npm test`, `npm run typecheck`, and `npm run build`.
- [ ] Commit the SDK workspace as one independently reviewable milestone.

### Task 3: Implement runtime manifest validation

**Files:**
- Create: `packages/game-sdk/src/validateManifest.ts`
- Test: `packages/game-sdk/src/validateManifest.test.ts`
- Modify: `packages/game-sdk/src/index.ts`

**Interfaces:**
- `parseGameManifest(input: unknown, options: ManifestValidationOptions): GameManifestV1`
- `ManifestValidationOptions` supplies supported SDK range, approved artifact origins, and manifest byte/field limits.
- Invalid data throws a typed `ManifestValidationError` with a stable error code; callers never render partially validated manifest data.

- [ ] Write tests for valid minimal manifest, duplicate/invalid ID, unknown root/nested fields, invalid semantic version, unsupported SDK range, incomplete bilingual copy, oversized strings, payload-size overflow, invalid player limits, invalid digest format, and capability outside the allowlist.
- [ ] Write URL tests for `javascript:`, `data:`, `file:`, protocol-relative URLs, credentials embedded in URL, non-HTTPS release URLs, unapproved hosts and URL fragments that would change the release identity.
- [ ] Implement strict plain-object checks and schema validation; do not coerce invalid values or silently drop unknown fields.
- [ ] Keep artifact-origin allowlisting as validation policy, not a user-controlled trust decision. Only a trusted registry may supply approved artifact metadata.
- [ ] Run focused tests and full test/typecheck/build gates; commit.

### Task 4: Separate catalog metadata from installed/launchable plugins

**Files:**
- Create: `src/catalog/catalogTypes.ts`
- Create: `src/catalog/catalogProvider.ts`
- Create: `src/catalog/localCatalogProvider.ts`
- Create: `src/catalog/catalogState.test.ts`
- Modify: `src/catalog/gameRegistry.ts`
- Modify: `src/catalog/gameRegistry.test.ts`
- Modify: `src/App.tsx` as needed to consume catalog provider

**Interfaces:**
- `CatalogEntry` carries safe display metadata and a non-authoritative availability state.
- `PluginRegistryRecord` from the SDK carries the validated manifest/version and trusted approval state, separate from catalogue metadata. `ApprovedPluginRecord` is the only provider return type eligible for launch decisions.
- `PluginRegistryReader.getRecord(gameId: string): Promise<PluginRegistryRecord | null>` retrieves the trusted record for validation; the reader must never treat browser-supplied records as authoritative.
- `CatalogProvider extends PluginRegistryReader` and exposes `listCatalog(): Promise<CatalogEntry[]>` plus `listApprovedPlugins(): Promise<ApprovedPluginRecord[]>` as separate read concerns. Production provider can be attached to the trusted backend later; the local provider is a non-production test/demo adapter.

- [ ] Test that zero catalog entries and zero approved plugins are valid states, with no thrown error and no fake installed game.
- [ ] Test that a visible catalog entry without an approved compatible plugin is rendered as unavailable/upcoming, never as playable.
- [ ] Move display-only fixture data out of the platform logic. Existing titles may remain as planned catalog metadata, but must not imply a playable engine or online readiness.
- [ ] Ensure registry compatibility and capability checks happen before a launch button can become active.
- [ ] Keep safe localized display metadata available in English and Persian, with explicit category and player count fields rather than deriving data from a game-specific component.
- [ ] Run focused tests and full test/typecheck/build gates; commit.

### Task 5: Remove direct game-engine dependencies from the platform shell

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.session.test.tsx` only where behavior has intentionally changed
- Create: `src/platform/gameLaunch.ts`
- Create: `src/platform/gameAvailability.ts`
- Create: `src/platform/gameAvailability.test.ts`
- Preserve: `src/games/tictactoe.ts`, `src/games/tictactoe.test.ts`, `src/games/checkers.ts`, `src/games/checkers.test.ts`

**Interfaces:**
- `getGameAvailability(entry: CatalogEntry, plugin: ApprovedPluginRecord | null): GameAvailability` returns `"unavailable" | "review" | "enabled" | "incompatible"`.
- `requestGameLaunch(gameId: string, registry: PluginRegistryReader): Promise<ApprovedPluginDescriptor>` returns only a host-validated approved descriptor; it does not import a game engine or execute plugin code.
- The platform shell owns navigation/account/profile/catalog/social/support/preferences; the plugin host owns only lifecycle for an approved plugin.

- [ ] Add tests showing that an empty registry, disabled plugin, pending-review plugin or incompatible SDK shows an unavailable message and never opens a game UI.
- [ ] Remove imports of `applyTicTacToeMove`, `chooseTicTacToeBotMove`, `createTicTacToeState`, `applyCheckersMove`, `chooseCheckersBotMove` and `createCheckersState` from `src/App.tsx` and other platform components.
- [ ] Remove game-specific board states/renderers and game-specific online queue/room assumptions from the platform component. Preserve platform routes and present truthful empty/unavailable states when no compatible game is enabled.
- [ ] Keep existing pure engine files/tests intact as legacy game source. They may continue to pass in their independent test suite, but they must not be reachable through platform imports.
- [ ] Preserve the currently accepted platform visual design, responsive right-side desktop drawer, English default, Persian RTL, favorites/search, account/settings and safe wallet preview.
- [ ] Run UI tests for home/navigation/catalog/favorites/locale/session isolation and tests for unavailable-game states. Update old UI tests only where the product behavior intentionally changes; do not weaken engine tests.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`; commit.

### Task 6: Add a platform/game import-boundary check

**Files:**
- Create: `scripts/check-platform-boundary.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Test: `scripts/check-platform-boundary.test.mjs` if the check is factored as a testable function

- [ ] Write a test fixture containing a forbidden `src/games/` import from a platform-owned directory and verify the checker fails.
- [ ] Implement a small deterministic source scan for platform-owned paths (`src/app/`, `src/platform/`, `src/catalog/`, `src/plugin-host/`) that rejects imports resolving to individual game code.
- [ ] Keep the scan narrow and documented; it must not pass merely because a filename or comment contains the term "game".
- [ ] Add `npm run check:platform-boundary` and run it in CI before build.
- [ ] Verify the existing platform source passes and the negative fixture fails; then run the full CI-equivalent local command set and commit.

### Task 7: Prove the zero-game platform state

**Files:**
- Modify: `src/App.test.tsx`
- Create: `src/catalog/emptyCatalog.test.ts`
- Modify: `docs/ENGINEERING_BASELINE.md`
- Modify: `docs/PROJECT_CHECKPOINT_2026-10-22.md`

- [ ] Add a no-plugin test that boots the app with empty catalog/plugin providers; verify dashboard, navigation, settings, search and locale switching still work.
- [ ] Verify zero plugin entrypoints are fetched/launched in the no-plugin state.
- [ ] Verify the browser does not call game-specific ranked/room RPCs when no enabled plugin advertises those capabilities.
- [ ] Add error/empty/loading UI checks for catalog-provider failures and timeouts; core navigation must remain available.
- [ ] Run all existing unit tests, `npm run typecheck`, `npm run build`, dependency audit and boundary check.
- [ ] Update engineering baseline/checkpoint with exact commands and results. Commit and open/update the phase PR; do not merge without review.

## Exit gate

This plan is complete only when the core has no direct game-engine dependency, an empty plugin registry is an accepted and tested state, the SDK/manifest validators are versioned and tested, CI enforces the boundary, and the exact commit passes the required quality gates. This does not declare Supabase live, the isolated plugin runtime complete, or the platform production-ready; those are covered by the separate runtime and Supabase/platform readiness plans.

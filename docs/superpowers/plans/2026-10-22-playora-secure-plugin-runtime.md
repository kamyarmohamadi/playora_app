# Playora Secure Game Plugin Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this plan task-by-task after the core/SDK plan has passed review. Track each task, run its tests, commit each milestone, and update the project checkpoint.

**Goal:** Implement a generic, fault-tolerant plugin host that launches only trusted approved game artifacts in an isolated runtime and cannot expose platform secrets or private sessions to game code.

**Architecture:** Use the approved versioned Game SDK from the core plan. The host creates a scoped session and launches an immutable, allowlisted artifact in a sandboxed iframe. Host/plugin messages are schema-validated, session-bound and size-limited; the iframe is treated as untrusted and does not receive credentials. The first runnable artifact is a test-only protocol fixture, not a playable game.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, the approved `@playora/game-sdk` package, Vitest, Playwright (pinned after compatibility verification), GitHub Actions, and the selected static game-artifact hosting origin when configured.

**Spec:** `docs/superpowers/specs/2026-10-22-playora-platform-game-plugin-architecture.md`

**Prerequisite plan:** `docs/superpowers/plans/2026-10-22-playora-platform-core-game-sdk.md`

**Current implementation checkpoint (2026-10-22):** Manifest/message validation and launch-policy checks are implemented with tests. The generic GamePluginHost and catalog launch gate are wired through `prepareGameLaunch`; explicit grants are stored separately from manifest requests. The local artifact digest verifier and import-boundary check are committed. Lifecycle regression testing found a bug: changing an immutable descriptor did not rotate the nonce, allowing a stale `plugin:ready` to be accepted. The host now restarts the session for game/version/URL/digest/SDK/capability/policy changes, invalidates the previous nonce, ignores messages after failure/exit and stops on a second frame load. CI run [39697862076](https://github.com/kamyarmohamadi/playora_app/actions/runs/39697862076) passed all three jobs and 106 unit tests. Still open: true Playwright/cross-origin hostile-fixture browser tests, session timeout/revocation edge coverage, artifact release pipeline and target-host CSP/headers verification. No playable game artifact is enabled or launched.

## Global Constraints

- The host must never execute game-provided source in the React application origin.
- An ordinary folder, workspace, React component, or same-origin iframe is not a security sandbox.
- Start with the strictest workable iframe sandbox: `sandbox="allow-scripts"`; do not add `allow-same-origin`, popups, forms, downloads, or top-navigation without a documented threat-model review.
- Do not pass cookies, access/refresh tokens, service-role keys, private profile data, wallet details or privileged client credentials to a plugin.
- Verify message source, per-session nonce, protocol version, message schema, size and allowed message types. `origin: null` is never sufficient proof of identity.
- Registry input is trusted only after server-side validation and approval. Never load arbitrary user-provided URLs.
- Plugin claims about score, winner, rating, XP, wallet, payment or identity are untrusted intents, never authority.
- Preserve graceful host behavior when a plugin errors, hangs, has a bad manifest, or is disabled/revoked.
- No real game implementation or game porting in this phase; use a hostile/test protocol fixture only.
- No changes to `main`, no admin panel implementation, and no real-money/crypto feature enablement.

## Review Focus

- **Wrong window/source:** a message from another iframe or the top page must be rejected.
- **Stale session:** messages with an old/replayed nonce, prior session ID or old protocol version must not modify the current session.
- **Opaque origin:** `origin === "null"` cannot by itself authorize a message; source-window identity and session handshake must both match.
- **Malformed/oversized payload:** invalid JSON-like values, unknown message type, extra fields, large strings or oversized messages must be rejected without crashing the host.
- **Untrusted artifact failure:** bad URL, load failure, navigation, script exception, hang or timeout must leave the host shell operable and must never leak tokens or privileged state.

---

### Task 1: Define and test the session handshake and message schemas

**Files:**
- Modify: `packages/game-sdk/src/protocol.ts`
- Create: `src/plugin-host/validatePluginMessage.ts`
- Test: `src/plugin-host/validatePluginMessage.test.ts`
- Modify: `packages/game-sdk/src/protocol.test.ts`

**Interfaces:**
- `createPluginSessionId(): string` returns an unpredictable per-session nonce/ID using Web Crypto.
- `validatePluginMessage(input: unknown, context: PluginMessageContext): ValidatedPluginMessage | null` returns a parsed allowlisted message or `null` with a safe rejection code.
- Each message includes protocol version, current session ID/nonce, allowed message type, bounded request ID and the smallest required payload.

- [ ] Write failing tests for host-ready, plugin-ready, resize, pause/resume, leave, safe telemetry and capability request intents.
- [ ] Add negative tests for wrong protocol version, missing nonce, stale nonce, duplicate/oversized request ID, unknown fields, unknown message type, invalid dimensions, non-string IDs, payload-size overflow and capability outside the grant list.
- [ ] Bind message validation to the exact expected `iframe.contentWindow`; reject messages from every other source, even if the message data is otherwise valid.
- [ ] Generate session nonces using `crypto.getRandomValues`; do not use timestamps, incremental counters, `Math.random` or client-supplied session IDs as proof.
- [ ] Ensure validation has no side effects; authorization and service calls occur only after validation.
- [ ] Run focused protocol tests and full typecheck; commit.

### Task 2: Build the generic iframe host lifecycle

**Files:**
- Create: `src/plugin-host/GamePluginHost.tsx`
- Create: `src/plugin-host/usePluginSession.ts`
- Create: `src/plugin-host/pluginHost.css`
- Test: `src/plugin-host/GamePluginHost.test.tsx`
- Modify: platform launch component from the core plan

**Interfaces:**
- `GamePluginHostProps` accepts an already validated `ApprovedPluginDescriptor`, scoped public presentation context and `onExit` / `onError` callbacks.
- It does not accept raw URLs from user input, raw manifest JSON, Supabase client instances, credentials, or an arbitrary `postMessage` callback.
- Lifecycle state is a union such as `loading | handshaking | ready | paused | failed | exited`.

- [ ] Write failing tests for initial loading, a valid handshake, explicit exit, close/cancel while loading, and safe error presentation.
- [ ] Implement iframe mounting only after the registry service yields a compatible approved descriptor and runtime policy accepts its artifact origin.
- [ ] Use the strict sandbox attribute and least-privilege iframe permissions; set a restrictive referrer policy and descriptive title/accessible status.
- [ ] Send only non-sensitive presentation context (for example locale and public display alias when explicitly granted); never pass session tokens, cookies, Supabase client objects or privileged secrets.
- [ ] Keep the app shell mounted and navigable while a game iframe is active; the game cannot remove/cover host-level close or recovery controls.
- [ ] Ensure each session gets a new nonce and previous event listeners/timers are cleaned up on unmount, exit, identity change or session replacement.
- [ ] Test keyboard/focus behavior, accessible loading/error status and responsive sizing; run tests/typecheck/build and commit.

### Task 3: Enforce runtime trust, compatibility and integrity metadata

**Files:**
- Create: `src/plugin-host/pluginPolicy.ts`
- Test: `src/plugin-host/pluginPolicy.test.ts`
- Modify: `src/catalog/catalogProvider.ts`
- Modify: registry contract tests from the core plan

**Interfaces:**
- `canLaunchPlugin(record: PluginRegistryRecord, policy: RuntimePolicy): LaunchDecision` returns allow/deny plus a stable reason code.
- `RuntimePolicy` contains the supported SDK range, allowed artifact origins, maximum manifest size, permitted capability set and minimum integrity metadata.

- [ ] Write tests that deny unapproved, review-pending, disabled, revoked, incompatible and missing-artifact records.
- [ ] Write tests that deny user-supplied URLs, HTTP on a production origin, unknown origins, mutable/unversioned artifact URLs and missing/malformed artifact digests.
- [ ] Distinguish registry-controlled approval state from plugin-authored metadata; never trust a manifest to mark itself approved/enabled.
- [ ] Use immutable versioned artifact paths and store the expected digest as release metadata. Validate artifact integrity in the trusted build/release pipeline; do not claim that iframe sandboxing alone verifies the artifact.
- [ ] Keep registry writes unavailable to anonymous/authenticated browser clients. The trusted registry publisher/deployment path is implemented in the Supabase/platform plan, not by a UI toggle.
- [ ] Run tests/typecheck/build and commit.

### Task 4: Handle plugin failures, hangs and revocation safely

**Files:**
- Modify: `src/plugin-host/usePluginSession.ts`
- Modify: `src/plugin-host/GamePluginHost.tsx`
- Test: `src/plugin-host/usePluginSession.test.ts`
- Test: `src/plugin-host/GamePluginHost.test.tsx`

- [ ] Write tests for iframe error, handshake timeout, runtime timeout, invalid-message threshold, host navigation away, user cancel, rejected capability request and plugin exit.
- [ ] Implement bounded handshake/startup timeout with cleanup. The timeout must use the app's lifecycle utilities, not an unbounded promise/listener.
- [ ] Repeated malformed messages must be rejected and logged as redacted diagnostics; do not include arbitrary payload values or credentials in logs.
- [ ] On error/revoke, stop accepting the current session's messages, clear timers/listeners and return to the platform with a safe retry/back action.
- [ ] Make game launch idempotent for a single session; double clicks must not start duplicate iframe sessions.
- [ ] Test that errors in the plugin do not affect navigation, account settings or other platform state.
- [ ] Run tests/typecheck/build and commit.

### Task 5: Add a test-only hostile plugin fixture and real browser checks

**Files:**
- Create: `tests/e2e/fixtures/plugin-safe/index.html`
- Create: `tests/e2e/fixtures/plugin-hostile/index.html`
- Create: `tests/e2e/plugin-host.spec.ts`
- Create: `playwright.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/workflows/ci.yml`

- [ ] Verify current Node.js and the selected Playwright version from official docs before pinning the exact package version; do not install `latest`.
- [ ] Add the smallest compatible pinned browser-test dependency and a `test:e2e` script; keep existing npm commands intact.
- [ ] Serve the host and fixtures on distinct origins in CI to exercise the actual cross-origin/sandbox boundary.
- [ ] Add browser checks for valid handshake, wrong source, stale nonce, malformed payload, close/back, timeout/error recovery, no-plugin state, no horizontal overflow at 390px, desktop drawer operation, and Persian RTL.
- [ ] The hostile fixture should attempt harmless prohibited actions (read `parent.document`, request an ungranted capability, send an invalid message, and navigate top-level); assert denial/rejection and host survival.
- [ ] Assert no auth token, service key, wallet details or private account fields are sent to the iframe or included in test diagnostics.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e` and the dependency audit; commit.

### Task 6: Integrate artifact-host policy and production security headers

**Files:**
- Modify: `public/_headers`
- Modify: `docs/SECURITY_MODEL.md`
- Modify: `docs/PRODUCTION_READINESS.md`
- Create: `docs/architecture/PLUGIN_RUNTIME_SECURITY.md`

- [ ] Document the planned separate game-artifact origin, allowed origins, release directory/versioning, artifact digest generation and revocation procedure.
- [ ] Ensure the platform Content Security Policy `frame-src` is restricted to the chosen game origin and required Supabase origins. Do not allow arbitrary sources or wildcard game origins.
- [ ] Configure sandbox and CSP headers for game artifacts separately from the platform. Do not infer that `public/_headers` is automatically enforced by every hosting provider.
- [ ] Verify the actual response headers and CSP on staging before production. Keep this task blocked from any claim of "production-secure" until a host/origin is chosen and browser-tested.
- [ ] Run the browser checks and all CI quality gates; record exact output and commit.

## Exit gate

This plan is complete only when the host launches solely validated/approved artifacts, plugin messages are session-bound and schema-validated, plugin failures are recoverable, hostile-fixture browser tests confirm the isolation behavior, and the actual hosting/CSP assumptions are documented and tested. This still does not mean any playable game is approved or implemented. Game implementation begins only after the platform-only release gate passes.

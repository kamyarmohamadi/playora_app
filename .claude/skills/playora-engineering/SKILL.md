---
name: playora-engineering
description: Build, review, test, secure, and visually validate Playora, a Persian-first modular game platform. Use for every Playora architecture, UI, game-logic, security, test, or release change.
---

# Playora Engineering Skill

Use this skill for every meaningful change to Playora. Optimize for player trust, correct game rules, a premium Persian RTL experience, modularity, and evidence-backed delivery—not merely producing code quickly.

## 1. Start with evidence

1. Read the repository root instructions, the engineering baseline, and the relevant game or package documentation before changing code.
2. Inspect the actual tree, package manager, scripts, lockfiles, current branch, and recent changes. Archives and old audit reports are evidence, not automatically the current source of truth.
3. Identify what can actually be built and tested in the current repository. If the app source or a required tool is missing, report the blocker and complete useful documentation or static checks without pretending the app was tested.
4. Make a small, reviewable change on a feature branch. Never force-push, rewrite history, or change main directly.

## 2. Architecture and module boundaries

- Keep the platform shell, game catalog/registry, shared UI, game SDK, and individual games as separate modules with explicit contracts.
- Treat the game manifest as untrusted input. Validate it at runtime with a schema; reject unknown fields or unsupported API versions where appropriate. Do not confuse a permission declaration with an enforced permission.
- Keep game rules in a framework-independent, deterministic engine wherever practical. The UI renders state and submits player actions; it must not become the authority for rules, scores, or turn legality.
- Give every game an explicit, versioned contract: identity, version, API compatibility, startup, state transitions, events, and supported capabilities.
- Keep inter-game dependencies prohibited by default. Shared features belong in the platform SDK, with backward-compatible versioning and tests.
- Do not add accounts, online multiplayer, payments, leaderboards, analytics, or remote services as placeholders that look functional. Mark roadmap items as not implemented until they work end-to-end.

## 3. Security requirements

Threat-model the feature before implementing it. Client-side validation improves UX but is not a security boundary.

- Do not execute downloaded or user-controlled source with eval, Function constructors, or unsafe HTML injection. Avoid dangerouslySetInnerHTML unless a documented, reviewed, and sanitized use case truly requires it.
- Do not treat an ordinary React component, JavaScript module, or same-origin DOM as a sandbox for untrusted games. When external/untrusted game code is introduced, run it on a dedicated origin where possible and in an iframe with the minimum sandbox capabilities. Do not grant allow-same-origin, popups, navigation, forms, downloads, or top-level access without a documented threat-model justification.
- Define a restrictive Content Security Policy and other appropriate browser security headers at the hosting layer. Never claim CSP exists when it is only described in documentation.
- Validate every postMessage boundary: expected window/source, permitted origin where applicable, message schema, protocol version, message size, and session/capability token. If an opaque sandbox origin produces origin null, do not trust null as an identity; combine window identity with a per-session unpredictable handshake and strict schema validation.
- Use exact-origin targeting when possible. Never accept arbitrary message types or treat a game-provided manifest/permission list as proof of authorization.
- Keep secrets off the client. Treat the client as untrusted for ranking, matchmaking, multiplayer outcomes, and any future monetized behavior.
- Minimize dependencies, pin compatible versions, retain the package manager lockfile, review dependency changes, and investigate security alerts rather than blindly applying broad upgrades.
- Keep permissions/capabilities deny-by-default. Add a capability only for a documented product need and test that denied capabilities remain unavailable.

## 4. Game correctness

Use tests to encode rules, including boundaries and invalid actions. Prefer pure functions and reproducible test fixtures.

For backgammon, before describing it as rules-complete, verify at minimum: initial setup; dice generation and doubles; legal movement; blocked points; hitting a blot; bar-entry priority; mandatory use of available dice; the higher-die rule when only one die can be played; legal sequencing of two moves; bearing off; overshoot restrictions; turn completion; win detection; and edge cases when only some dice are playable. Cross-check against recognized rules and document any house-rule choices.

Do not implement a visually plausible board whose controls permit illegal moves. Keep a clear separation between selected UI pieces and authoritative legal-move generation.

For every additional game, include win, loss, draw, reset/restart, turn order, invalid-action, and game-over tests as applicable. UI tests alone do not replace engine tests.

## 5. Persian RTL product quality

- Use Persian as the default user-facing language and explicitly set lang=fa and dir=rtl at the right document/app boundary.
- Prefer CSS logical properties (inline-start/end, margin-inline, padding-inline) over hard-coded left/right assumptions.
- Test Persian text, mixed Persian/English labels, digits, punctuation, dialogs, menus, and narrow widths. Avoid directionality bugs around IDs, versions, scores, and code-like strings.
- Design a consistent system for typography, spacing, colors, surfaces, border radii, focus states, icons, and motion. Do not add arbitrary gradients, emojis, or decoration without a coherent visual purpose.
- Prioritize the playable board and primary action. Use responsive layouts with no unintended horizontal overflow, large enough touch targets, visible keyboard focus, useful empty/error states, readable contrast, and reduced-motion support.
- Verify both mobile and desktop. A screenshot can document appearance, but interactions and game correctness must also be exercised.

## 6. Required verification

Adapt the commands to the repository's real scripts; never invent test results or add fake scripts just to make a checklist appear green.

When the runnable app exists, run the relevant equivalents of:
1. Clean, lockfile-based dependency installation (for npm, npm ci).
2. Unit tests for engine, manifest validation, and shared contracts.
3. Type checking and linting.
4. Production build.
5. Browser tests with Playwright for critical user journeys, console/page errors, failed requests, keyboard usage, and responsive behavior.
6. Security/dependency checks relevant to the change.

For gameplay changes, test valid and invalid moves, state transitions, restart behavior, and edge cases. For RTL/layout changes, inspect at least one narrow mobile and one desktop viewport. Capture screenshots of meaningful UI changes when browser tooling is available.

If a command fails, record its exact command and the useful error; fix it or report the remaining blocker. Never state “all tests passed” unless the relevant tests were actually run in the current version of the code.

## 7. Delivery standard

Every meaningful iteration must include:
- A concise explanation of what changed and why.
- The branch/commit or pull request URL.
- Exact test commands run and pass/fail results.
- A preview URL or verifiable screenshots when the UI changed; if unavailable, say why.
- Known limitations and the next highest-value task.

Keep main unchanged unless the repository owner explicitly approves integration. Prefer a reviewable pull request. Ask Claude or another agent for an independent, evidence-based review when useful, but do not delegate correctness blindly: verify each finding against the diff and tests.

## Reference material

Use these as guidance, not as a substitute for project-specific review:
- Vercel React Best Practices: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
- Anthropic Frontend Design: https://github.com/anthropics/skills/tree/main/skills/frontend-design
- Microsoft Playwright skill: https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/tools/skills/playwright-cli/SKILL.md
- Trail of Bits security skills: https://github.com/trailofbits/skills
- OWASP Application Security Verification Standard: https://owasp.org/www-project-application-security-verification-standard/
- MDN Content Security Policy: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP

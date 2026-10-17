# Playora Repository Instructions

Before substantive work, read docs/ENGINEERING_BASELINE.md and the Playora Engineering Skill at .agents/skills/playora-engineering/SKILL.md. Claude Code users should also load .claude/skills/playora-engineering/SKILL.md.

## Repository and workflow

- Inspect the actual files, branches, scripts, and lockfile before choosing an implementation plan.
- The default branch is not a scratchpad. Use a narrowly scoped feature branch and a reviewable pull request; do not force-push or rewrite shared history.
- Keep changes focused. Do not create an apparently functioning UI for a feature whose underlying behavior is missing.
- Treat archives as historical source material until extracted, reviewed, tested, and promoted to a documented source-of-truth location.
- Never put secrets, access tokens, private keys, or production credentials in source control.
- Do not claim commands, browser checks, previews, or audits were completed unless they were actually run against the current code.

## Architecture

- Separate the platform shell, shared design system, game SDK/contracts, game registry, game engines, and game-specific interfaces.
- Game engines should be deterministic and testable independently of React where practical.
- Validate manifests at runtime and version the platform/game API contract.
- No game may access another game's internal state by default.
- Treat permissions as enforceable capabilities, not labels in metadata. Untrusted game code must not share the host DOM or be considered safe merely because it is a module.

## Security

- No eval, Function-based execution, or unsafe HTML injection for game content.
- When untrusted game code is supported, use a security-reviewed origin boundary, minimum iframe sandbox privileges, restrictive CSP/headers, schema-validated messaging, and a per-session handshake. Do not trust origin null by itself for opaque-origin frames.
- Deny access by default and document every exception. Client-side checks are not server-side authorization.
- Review new dependencies and lockfile changes. Do not casually use floating latest versions.

## Quality gates

When the real app/tooling exists, run the applicable clean install, unit tests, type checks, lint, production build, Playwright user journeys, responsive/RTL visual checks, and security/dependency scans. Follow the actual package manager and repository scripts; don't invent commands or fake green status. If the repository lacks the required source/tooling, state that explicitly and do not report a successful build.

For gameplay, test valid and invalid moves and boundary conditions. For UI changes, verify mobile and desktop and provide a preview or screenshots when possible.

## Definition of done

A change is done only when its behavior is described, relevant tests have been run, results and limitations are reported, and the branch/commit/PR is linked. Security claims must be backed by implemented controls and evidence. See the full Playora Engineering Skill for detailed requirements.

# Playora Architecture Checkpoint — 2026-10-22

## Current task
Separate the Playora platform from all individual game implementations. The platform must boot, navigate and expose its core surfaces when zero game plugins are installed. Later, each game will be implemented/versioned separately and added through a trusted, validated plugin registry without edits to platform core code.

## Source of truth
- Private repository: https://github.com/kamyarmohamadi/playora_app
- Application baseline branch: `feature/playora-neon-ui-member-isolation`
- Baseline commit: `e5ab2b0d6c5bb82eb2685333e7e1c6743b25d7f3`
- Architecture branch: `feature/playora-platform-game-plugin-architecture-2026-10-22`
- Draft review PR #7: https://github.com/kamyarmohamadi/playora_app/pull/7 (documentation only; not merged)
- Architecture spec (owner approved 2026-10-22): [2026-10-22-playora-platform-game-plugin-architecture.md](./superpowers/specs/2026-10-22-playora-platform-game-plugin-architecture.md)
- Last plan-content commit before this checkpoint refresh: `7ad4c17fe9ad07d36c45e53c9fb0f1288769e835`
- Application PR #5 remains open/draft and is not merged. Admin preview PR #6 remains separate/open/draft and is not in scope.
- No Supabase project was returned by the connected Supabase account on 2026-10-22. No real database/Auth/Edge Functions may be described as deployed.

## Current source evidence
- `src/App.tsx` imports Tic Tac Toe and Checkers logic and contains game-specific UI/session handling, plus Tic Tac Toe-specific online queue/private-room assumptions.
- `src/catalog/gameRegistry.ts` stores metadata in a static manifest and app-side visual allowlists.
- `src/games/tictactoe.ts` and `src/games/checkers.ts` should be preserved as legacy source for later independent packaging/porting, not expanded during the platform-only milestone.
- CI at baseline includes unit tests, TypeScript, Vite production build, PostgreSQL security/game invariant checks and Deno Edge Function checks. Latest observed run for commit `e5ab2b0d6c5bb82eb2685333e7e1c6743b25d7f3` passed on 2026-10-20; it is not evidence of current unrun changes or production readiness.

## Work completed in this checkpoint
- Created and received owner approval for the architecture spec on an isolated feature branch.
- Saved a top-level completion roadmap and three task-level plans: core/SDK decoupling, secure plugin runtime, and Supabase/platform readiness.
- Saved a Supabase readiness audit based on live connector data and current official docs, including the 2026-10-30 Data API explicit-exposure change.
- No application runtime/source code has been changed yet. This checkpoint is in implementation-plan review; implementation must not begin until the owner approves the plans.

## Owner approval and current phase
- The owner approved the modular platform/game architecture on 2026-10-22.
- The project is now in **implementation-plan review**. No application source code has changed in this phase; this is intentional because the architecture work is broad and the plan must be reviewed before implementation.
- PR #7 is the review surface for the architecture spec, plans and audit. It remains unmerged. Main is untouched.

## Saved implementation plans
- Program roadmap: [2026-10-22-playora-platform-completion-roadmap.md](./superpowers/plans/2026-10-22-playora-platform-completion-roadmap.md)
- Plan A — core/SDK separation: [2026-10-22-playora-platform-core-game-sdk.md](./superpowers/plans/2026-10-22-playora-platform-core-game-sdk.md)
- Plan B — secure plugin runtime: [2026-10-22-playora-secure-plugin-runtime.md](./superpowers/plans/2026-10-22-playora-secure-plugin-runtime.md)
- Plan C — Supabase and platform readiness: [2026-10-22-playora-platform-supabase-readiness.md](./superpowers/plans/2026-10-22-playora-platform-supabase-readiness.md)
- Supabase account/source audit: [SUPABASE_READINESS_AUDIT_2026-10-22.md](./supabase/SUPABASE_READINESS_AUDIT_2026-10-22.md)

## Supabase live status checked 2026-10-22
- Development project `playora-dev` exists in the connected Supabase account; project reference: `nnowvfewtrfurnluhflt`. The project is in the EU Central region.
- Applied migrations verified in the connected project include member isolation, private rooms, social/leaderboard, match identifier privacy, account deletion, platform-only game RPC lockdown, public catalog/plugin registry, registry hardening, and `20261023000100_plugin_origin_state_guards`.
- Live SQL verification after the latest migration confirms RLS is enabled on `catalog_games`, `game_plugin_versions`, and `game_plugin_artifact_origins`; browser roles cannot read or modify the trusted-origin allowlist.
- Current release-gate state is intentionally closed: zero game plugins are registered, zero origins are approved, and zero catalog games are enabled. The catalog exposes eight display-only metadata rows; no game is launchable.
- Supabase Security Advisor currently reports three warnings for authenticated execution of SECURITY DEFINER social RPCs (`list_social_relationships`, `send_friend_request`, and `respond_friend_request`). These require code/grant review; do not dismiss them solely because the app has RLS.
- Live Auth settings, email/OAuth flows, deployed Edge Functions, two-real-user RLS tests, production hosting headers, backups/monitoring, and end-to-end browser verification remain unverified. The live database and CI tests are not a substitute for those checks.
- The GitHub quality-gate workflow is being rerun after a TypeScript fix; only report success after the latest commit's full CI finishes.

## Current implementation order
1. Owner reviews the roadmap and Plans A–C.
2. Implement Plan A first: SDK/manifest and remove direct game-engine imports from the host.
3. Implement Plan B after SDK contracts are stable.
4. Implement Plan C's offline prep while awaiting explicit approval for development project creation; run live integration steps only after approved project provisioning.
5. Do not implement or port any games until the platform-only release gate is satisfied.

## Non-negotiable rules
- Do not build or expand games until platform-only acceptance gates are met.
- Do not load arbitrary game URLs or execute plugin scripts in the host React app.
- Do not expose Supabase service-role keys or auth session tokens to a game iframe.
- Keep real payments, crypto deposits, entry fees, and prize-bearing competitions disabled pending actual server verification and relevant legal review.
- Preserve historical game code and admin preview files; do not delete/rebuild from scratch.
- When reporting status, always provide verified links to the checkpoint, PR, and an actual browser preview/screenshot after UI changes. Never claim a browser preview exists if it has not been produced and verified.

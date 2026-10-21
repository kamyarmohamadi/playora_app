# Playora Architecture Checkpoint — 2026-10-22

## Current task
Separate the Playora platform from all individual game implementations. The platform must boot, navigate and expose its core surfaces when zero game plugins are installed. Later, each game will be implemented/versioned separately and added through a trusted, validated plugin registry without edits to platform core code.

## Source of truth
- Private repository: https://github.com/kamyarmohamadi/playora_app
- Application baseline branch: `feature/playora-neon-ui-member-isolation`
- Baseline commit: `e5ab2b0d6c5bb82eb2685333e7e1c6743b25d7f3`
- Architecture branch: `feature/playora-platform-game-plugin-architecture-2026-10-22`
- Architecture spec (awaiting owner review): [2026-10-22-playora-platform-game-plugin-architecture.md](./superpowers/specs/2026-10-22-playora-platform-game-plugin-architecture.md)
- Latest commit on architecture branch at checkpoint creation: `54941f069e811a409c1f54e38a9a06cb32cf54ca`
- Application PR #5 remains open/draft and is not merged. Admin preview PR #6 remains separate/open/draft and is not in scope.
- No Supabase project was returned by the connected Supabase account on 2026-10-22. No real database/Auth/Edge Functions may be described as deployed.

## Current source evidence
- `src/App.tsx` imports Tic Tac Toe and Checkers logic and contains game-specific UI/session handling, plus Tic Tac Toe-specific online queue/private-room assumptions.
- `src/catalog/gameRegistry.ts` stores metadata in a static manifest and app-side visual allowlists.
- `src/games/tictactoe.ts` and `src/games/checkers.ts` should be preserved as legacy source for later independent packaging/porting, not expanded during the platform-only milestone.
- CI at baseline includes unit tests, TypeScript, Vite production build, PostgreSQL security/game invariant checks and Deno Edge Function checks. Latest observed run for commit `e5ab2b0d6c5bb82eb2685333e7e1c6743b25d7f3` passed on 2026-10-20; it is not evidence of current unrun changes or production readiness.

## Work completed in this checkpoint
- Created the architecture spec on an isolated feature branch.
- Defined target boundaries: platform core, versioned Game SDK, trusted registry, isolated iframe runtime, schema-validated message bridge and server-authoritative game services.
- Defined milestones and acceptance gates from contract tests through platform-only release readiness.
- No application runtime/source code has been changed yet. This is intentional: Superpowers architectural workflow requires the owner to review the written spec before the implementation plan is written.

## Immediate next step
Owner reviews and approves or requests changes to the architecture spec. Only after approval, write a step-by-step implementation plan in GitHub, self-review it, then implement one milestone at a time using test-first development. Each meaningful milestone must be committed and checkpointed; main is not to be modified directly.

## Non-negotiable rules
- Do not build or expand games until platform-only acceptance gates are met.
- Do not load arbitrary game URLs or execute plugin scripts in the host React app.
- Do not expose Supabase service-role keys or auth session tokens to a game iframe.
- Keep real payments, crypto deposits, entry fees, and prize-bearing competitions disabled pending actual server verification and relevant legal review.
- Preserve historical game code and admin preview files; do not delete/rebuild from scratch.
- When reporting status, always provide verified links to the checkpoint, PR, and an actual browser preview/screenshot after UI changes. Never claim a browser preview exists if it has not been produced and verified.

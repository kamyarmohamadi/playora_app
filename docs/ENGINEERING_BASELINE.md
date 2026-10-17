# Engineering Baseline

Updated 2026-10-17.

## Current repository state
- The default branch main originally contained project archives and audit notes rather than a complete application source tree.
- This feature branch establishes a canonical root-level React + TypeScript + Vite app shell. Historical archives under bazi/ are left untouched.
- The shell contains the home dashboard, illustrative game catalogue, global search, local favorites, guest profile, notification popover, settings and placeholder pages for Friends and Leaderboard.
- Game play, online multiplayer, registered accounts, backend persistence, rankings and production security infrastructure are not implemented in this milestone.

## Scope
Current priority is the main platform UI and shared experience. Game engines are intentionally out of scope until the shell is reviewed and stable. The catalogue labels unfinished games clearly.

## Verification
This file records expected checks, not their results. Run npm ci, npm test, npm run typecheck and npm run build against the exact branch version. Browser screenshots and responsive interaction checks should be performed when tooling is available. Never claim a check passed unless it was run.

## Next steps
1. Confirm tests and build, then inspect desktop and mobile layouts.
2. Refine navigation, spacing, typography and interactions using feedback.
3. Establish the game SDK/module contract as a separate milestone.
4. Implement game rules only after the platform shell is accepted.
5. Add account systems, multiplayer, CSP/hosting security and backend features in separate reviewed milestones.

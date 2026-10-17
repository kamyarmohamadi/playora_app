# Engineering Baseline

Updated 2026-10-17 after the first platform-shell verification pass.

## Current repository state

- The default branch main originally contained project archives and audit notes rather than a complete application source tree.
- This feature branch establishes a canonical root-level React + TypeScript + Vite app shell. Historical archives under bazi/ are left untouched.
- The shell contains the home dashboard, illustrative game catalogue, global search, local favorites, guest profile, notification popover, settings and placeholder pages for Friends and Leaderboard.
- Game play, online multiplayer, registered accounts, backend persistence, rankings and production security infrastructure are not implemented in this milestone.

## Scope

Current priority is the main platform UI and shared experience. Game engines are intentionally out of scope until the shell is reviewed and stable. The catalogue labels unfinished games clearly; game cards do not launch game logic.

## Verification performed on the feature branch

- Clean install: npm ci --no-audit --no-fund — passed.
- UI tests: npm test -- --reporter=dot — 7 tests passed.
- Type check: npm run typecheck — passed.
- Production build: npm run build — passed with Vite 7.3.7.
- Browser smoke (Chromium): home page returned HTTP 200; catalogue navigation, search, favorites, guest profile and settings interactions passed.
- Responsive smoke at 390 × 844: document and body widths remained 390 px, html direction was RTL, and the mobile navigation drawer opened.
- Browser runtime errors: none observed on final smoke pass. No HTTP responses >= 400 were observed during that pass.

These checks validate the current app shell only. They do not establish production security, correct game rules, authentication, multiplayer readiness, or release readiness.

## Next steps

1. Review the home-page information hierarchy, navigation and design system.
2. Refine keyboard and accessibility behavior, then capture user-facing visual previews.
3. Establish the game SDK/module contract as a separate milestone after the app shell is accepted.
4. Implement game rules only after the platform shell is stable and the scope is explicitly reopened.
5. Add account systems, multiplayer, CSP/hosting security and backend features as independently reviewed milestones.

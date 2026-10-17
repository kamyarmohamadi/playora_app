# Playora

Playora is a Persian-first, right-to-left game platform. This milestone focuses on the **main app shell and shared product experience**; game rules and game engines are explicitly out of scope for now.

## Main app shell
- Responsive Persian RTL dashboard and navigation.
- Home page with a branded hero and illustrative game catalogue cards.
- Games catalogue with global search and local favorites.
- Guest profile page, notification popover, basic settings dialog, and informative coming-soon states.
- Dedicated placeholder pages for Friends and Leaderboard.
- React + TypeScript + Vite, with UI tests for main interactions.

## Run locally
Requirements: Node.js compatible with the Vite version in package.json.

    npm ci
    npm test
    npm run typecheck
    npm run build
    npm run dev

## Scope boundary
This milestone does **not** implement backgammon, chess, tic-tac-toe, card games, online multiplayer, registered accounts, backend persistence, rankings, or production security infrastructure. Catalogue artwork is illustrative. The UI must not imply that an unfinished game is playable.

Read AGENTS.md, .agents/skills/playora-engineering/SKILL.md and docs/ENGINEERING_BASELINE.md before substantive changes.

# Playora

Playora is planned as a Persian-first, right-to-left modular game platform.

## Product direction

- A polished, responsive Persian (fa-IR) web/PWA experience.
- Start with local two-player backgammon.
- Use a second small game (such as Tic-Tac-Toe) to prove the game-module contract is reusable.
- Design explicit boundaries for the platform shell, game SDK, and individual games.
- Consider online multiplayer, accounts, rankings, and Android packaging only after the local-game foundation is correct.

## Current repository status

This repository is still at a bootstrap/documentation stage. The default branch contains project archives and audit notes rather than a complete, directly buildable application source tree. Do not assume a working production build, secure game sandbox, complete backgammon rules, or end-to-end browser tests are present.

Read [AGENTS.md](AGENTS.md) and [the engineering baseline](docs/ENGINEERING_BASELINE.md) before implementing features. The project-specific agent skill is available under .agents/skills and .claude/skills.

## Engineering principles

Correct rules before polish, explicit module contracts, deny-by-default permissions, a distinctive RTL design, automated tests, and verifiable previews. Keep work on feature branches and submit reviewable pull requests. Never claim a test or security control exists until it has been implemented and verified.

# GitHub Copilot instructions for Playora

Read AGENTS.md and docs/ENGINEERING_BASELINE.md before substantive work. Follow the detailed Playora Engineering Skill in .agents/skills/playora-engineering/SKILL.md.

The canonical app shell is a root-level React + TypeScript + Vite app. The current milestone focuses on the Persian RTL platform experience, not game mechanics. Keep the platform shell, shared SDK/contracts, registry and future game engines separated. Validate manifests and message boundaries at runtime; never treat in-process modules as a security sandbox for untrusted code. Avoid eval and unsafe HTML injection. Keep game rules deterministic and tested when game work is explicitly in scope.

Use CSS logical properties, verify desktop/mobile layouts, keep work on feature branches and report exact test results. Game engines, online multiplayer, accounts, backend services and production security infrastructure are not implemented in the current app-shell milestone. Do not imply unfinished games are playable.

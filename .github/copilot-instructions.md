# GitHub Copilot instructions for Playora

Read AGENTS.md and docs/ENGINEERING_BASELINE.md before substantive work. Follow the detailed Playora Engineering Skill in .agents/skills/playora-engineering/SKILL.md.

Build Playora as a Persian-first RTL modular game platform. Keep the shell, shared SDK/contracts, registry, and game engines separated. Validate game manifests and message boundaries at runtime. Never treat in-process modules as a security sandbox for untrusted code. Avoid eval and unsafe HTML injection. Keep game rules deterministic and unit-tested. Use CSS logical properties and test Persian text on mobile and desktop.

Do not edit main directly. Use focused branches/PRs, run real repository checks, and report exact results. Never claim a preview, build, security control, or test exists unless it was actually verified. This repository currently does not contain a complete directly buildable app source tree; check the baseline before assuming it does.

# Playora Platform Completion Roadmap — 2026-10-22

## Owner decision and scope

The owner approved the modular platform/game plugin architecture on 2026-10-22.

Priority: complete and test the Playora platform independently of every game. Do not implement or port new games until the platform-only release gate is satisfied. Preserve current game engine code for later packaging. Keep the admin-panel prototype and its draft PR separate and untouched.

## Baseline and working branch

- Private repository: https://github.com/kamyarmohamadi/playora_app
- Baseline app branch: \`feature/playora-neon-ui-member-isolation\`
- Baseline commit: \`e5ab2b0d6c5bb82eb2685333e7e1c6743b25d7f3\`
- Architecture branch: \`feature/playora-platform-game-plugin-architecture-2026-10-22\`
- Architecture/plan PR: https://github.com/kamyarmohamadi/playora_app/pull/7
- Architecture spec: \`docs/superpowers/specs/2026-10-22-playora-platform-game-plugin-architecture.md\`
- Current checkpoint: \`docs/PROJECT_CHECKPOINT_2026-10-22.md\`

## Workstreams and dependencies

### A. Platform core and Game SDK
Plan: [Platform core and Game SDK](./2026-10-22-playora-platform-core-game-sdk.md)

Build/verify the npm workspace, versioned manifest and message contracts, runtime manifest validation, data-only catalog provider, no-game shell, removal of direct engine imports, architecture guard, and zero-game tests.

**Exit gate:** the app boots with zero plugins and platform source cannot import any specific game engine.

### B. Secure plugin runtime
Plan: [Secure plugin runtime](./2026-10-22-playora-secure-plugin-runtime.md)

After the SDK interfaces are reviewed and stable, implement the isolated iframe lifecycle, session-bound validated message bridge, origin/artifact policy, recoverable failure states and hostile-fixture browser tests. No actual game is implemented in this workstream.

**Exit gate:** only trusted approved artifacts can launch; malicious or malformed plugin behavior cannot access host secrets or crash the platform; actual staging host/CSP assumptions are verified.

### C. Supabase and platform readiness
Plan: [Supabase staging and platform readiness](./2026-10-22-playora-platform-supabase-readiness.md)  
Audit: [Supabase readiness audit](../../supabase/SUPABASE_READINESS_AUDIT_2026-10-22.md)

This workstream can progress through code/CI prep while the project-creation approval is pending. Live integration steps require the owner to confirm the organization/region and explicitly approve provisioning. It includes migration corrections, explicit grants/RLS, trusted registry schema, Auth, Edge Functions, platform persistence/support intake, real two-member isolation tests and staging browser journeys.

**Exit gate:** the real development project, Auth/RLS, Edge Functions, Data API grants, server-side restrictions and platform journeys are tested. Anything dependent on an unavailable/untested backend stays non-live.

## Sequencing

1. Review/approve all three implementation plans; keep \`main\` unchanged.
2. Implement Plan A in small commits, running focused tests and full quality gates.
3. Reconcile the SDK interfaces, then implement Plan B with a test-only plugin fixture; no game package is produced.
4. In parallel only where dependencies allow, complete the no-project setup prep for Plan C. Provision the Supabase development project only after explicit owner approval.
5. Implement Plan C against the reviewed development project; keep all games disabled.
6. Perform a whole-branch code/security review, resolve findings, run the release gates, and update checkpoint/PR with browser-verifiable results.
7. Only after all platform gates pass, write a separate game-package plan. Then each game can be implemented and added without platform-core code changes.
8. Revisit the admin-panel prototype after the agreed platform gate; do not fold its existing draft PR into this work.

## Persistent delivery protocol

For every meaningful change:
- Work on the architecture/feature branch, never directly on \`main\`.
- Run test-first: add a failing test, verify failure, implement, verify pass.
- Run the repo's actual tests/typecheck/build/dependency audit and relevant SQL/Deno/browser tests.
- Commit the change and update \`docs/PROJECT_CHECKPOINT_2026-10-22.md\` with head SHA, tests, links, current blockers and next exact task.
- Keep PR #7 reviewable and unmerged until explicit review/acceptance.
- When the owner asks for status, include the checkpoint, current PR and a verified browser preview/link if the UI has changed. Never invent a preview URL or claim an unrun test passed.

## Current external blocker

Supabase account inspection shows one visible Free organization and no projects. The current base project quote in that organization is $0/month, but project creation has not been performed. The owner must explicitly confirm the organization and EU region before provisioning \`playora-dev\`. See the Supabase audit for current pricing limitations, required setup and the 2026-10-30 Data API exposure change.

# Playora

Playora is an English-first social games platform with Persian localization (RTL), a neon arena design system and an independently versioned game-plugin architecture.

## Status and source of truth

- **Private repository:** https://github.com/kamyarmohamadi/playora_app
- **Active development branch:** https://github.com/kamyarmohamadi/playora_app/tree/feature/playora-platform-game-plugin-architecture-2026-10-22
- **Open draft PR:** https://github.com/kamyarmohamadi/playora_app/pull/7
- **Recovery guide:** [docs/RECOVERY_AND_CONTINUATION.md](docs/RECOVERY_AND_CONTINUATION.md)
- **Project checkpoint:** [docs/PROJECT_CHECKPOINT_2026-10-22.md](docs/PROJECT_CHECKPOINT_2026-10-22.md)

Do not treat \`main\` or the separate admin-preview PR as the active source of this architecture work. Read the recovery guide first when resuming on another device or after a lost session.

## Run locally

Use a Node.js/npm version compatible with the pinned Vite toolchain:

\`\`\`bash
npm ci
npm test
npm run check:platform-boundary
npm run typecheck
npm run build
npm run dev
\`\`\`

Copy \`.env.example\` to an ignored local \`.env.local\` and configure only the browser-safe Supabase project URL plus publishable/legacy anon key if backend-connected local tests are needed. Without those values, the client must fail closed. Never put a service-role key in a \`VITE_\` variable or commit populated local environment files.

## Platform architecture

The app owns navigation, account/profile surfaces, localization, catalogue metadata and platform services. Individual games are meant to be independently versioned plugins loaded only through the validated Game SDK contract and isolated runtime. Platform-owned source must not import \`src/games/*\`; the import-boundary checker enforces this in CI.

The legacy Tic Tac Toe and Checkers engine code is preserved in the repository for later packaging/porting, but no game is currently approved for launch in this platform-only stage. The live development catalog contains 8 visible metadata rows; 0 catalog games are enabled, 0 plugin versions are registered, and 0 artifact origins are approved. A catalogue card is not proof that a playable engine exists.

Core modules include:
- \`packages/game-sdk/\` — versioned manifest and host/plugin protocol types plus strict runtime validation.
- \`src/plugin-host/\` — isolated game iframe lifecycle, validated messages, launch-policy enforcement and recoverable error state.
- \`src/catalog/\` — catalogue types, local fixture and Supabase-backed provider; metadata is separate from launch authorization.
- \`src/platform/\` — launch gate and platform-owned services/state.
- \`supabase/migrations/\` and \`supabase/tests/\` — schema, grants, RLS, registry and regression invariants.
- \`docs/superpowers/\` — approved architecture spec and phased implementation plans.

## Supabase development environment

A development project already exists:

- **Name:** \`playora-dev\`
- **Reference:** \`nnowvfewtrfurnluhflt\`
- **Region:** \`eu-central-1\`
- **Dashboard:** https://supabase.com/dashboard/project/nnowvfewtrfurnluhflt
- **API URL:** https://nnowvfewtrfurnluhflt.supabase.co

RLS is enabled for the catalogue/plugin registry tables; client roles cannot write plugin state or inspect approved artifact origins; legacy game RPCs remain blocked for browser roles. See [the current Supabase audit](docs/supabase/SUPABASE_READINESS_AUDIT_2026-10-22.md).

**Not yet live/verified:** the connected Supabase tool reports no deployed Edge Functions. Auth redirects/provider configuration, SMTP, real two-user Auth/JWT isolation tests, the frontend hosting/domain, CSP headers and the separate game artifact host remain incomplete. The remote migration history also contains duplicate \`plugin_registry_hardening\` labels; reconcile remote history and source files before any \`supabase db push\` or migration replay.

The latest verified CI run for the source head recorded in the recovery guide is linked there. CI success does not substitute for live Auth/browser testing, an independent security review, or a production deployment.

## Security rules

- Game code is untrusted and must not execute in the platform React origin.
- The game iframe receives no auth tokens, cookies, service-role keys, wallet details or privileged clients.
- Game messages are untrusted intents; protected data, match results and permissions remain server-authoritative.
- Keep the artifact-origin allowlist empty until hosting, digest verification, sandbox/CSP and revocation have been reviewed.
- Keep account deletion disabled until its real function is deployed and verified.
- Keep real-money/crypto deposits, paid entry and prize-bearing/convertible rewards disabled pending verified server-side payment controls and legal review.
- Never commit credentials or secrets. See the recovery guide for the exact secret/configuration boundary.

## Release process

Use [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) and [docs/RECOVERY_AND_CONTINUATION.md](docs/RECOVERY_AND_CONTINUATION.md) as release and recovery gates. No game should be implemented/ported until the platform-only acceptance gate is passed. The existing admin preview remains deferred and separate in PR #6.

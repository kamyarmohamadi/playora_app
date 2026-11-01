# Playora checkpoint — navigation and account UI (2026-10-23)

## Source of truth

- Repository: https://github.com/kamyarmohamadi/playora_app
- Active branch: `feature/playora-platform-game-plugin-architecture-2026-10-22`
- Draft PR #7: https://github.com/kamyarmohamadi/playora_app/pull/7
- `main` has not been changed by this work.

## Delivered in this checkpoint

- Desktop navigation starts collapsed. The top-bar ellipsis button opens/closes the navigation panel; on mobile it opens the off-canvas navigation drawer.
- The desktop panel has a resize grip and RTL-aware drag direction.
- Navigation and the sign-in dialog can be dismissed with Escape.
- Sign-in modal has a responsive two-panel, dark competitive-arena presentation with neon blue/purple lighting, Playora branding, game tokens, and a mobile-specific compact layout.
- Existing email sign-in, email sign-up/confirmation, password recovery, and Google OAuth calls remain connected to Supabase Auth APIs.
- Failed OAuth callback query/hash errors are replaced with a generic localized message and removed from the visible URL so raw provider error details are not left in the address bar.
- Added regression tests for Escape dismissal and failed OAuth callback handling.
- Added [Google OAuth setup guide](GOOGLE_AUTH_SETUP_FA.md) and linked it from the README.

## Latest relevant commits

- `1bc1a3b90d0091e5f4cb90fbd17c5b1fb8ecd82e` — OAuth callback regression test
- `fa3e5e258a585e1d65de95947e5c54259d15ee69` — safe OAuth callback error handling
- `1f925877c0a2c37d4f3ee41418050354c47984a4` — navigation/auth Escape tests
- `68009f83fa491d9dfa616f3270a90e288da4249e` — sign-in heading CSS selector fix
- `659312930911a6f98d4104eb76c338d628e87940` — Google Auth setup guide

## Verification and release blockers

The latest GitHub Actions run for `1bc1a3b90d0091e5f4cb90fbd17c5b1fb8ecd82e` failed before steps ran: all three jobs report `runner_id: 0` and `steps: []`. This is an infrastructure/runner failure, **not a passing test run and not evidence of a source-code failure**. Run: https://github.com/kamyarmohamadi/playora_app/actions/runs/40008534928

Real Google login is implemented in client code but is **not verified live** until the Supabase Google provider, Google Cloud OAuth client, redirect allowlist, browser-safe environment variables and deployed origin are configured. Follow [GOOGLE_AUTH_SETUP_FA.md](GOOGLE_AUTH_SETUP_FA.md).

This app is not yet a production-complete gaming service: no game plugins are enabled; the current catalogue entries are not proof of playable games. Hosting/domain, production CSP, live auth verification, migration-history reconciliation, and other release gates remain outstanding. Payments and prize-bearing competition stay disabled.

## Next required verification

1. Restore GitHub Actions runner availability and run the full quality gate.
2. Verify the new Escape tests and full TypeScript/production build.
3. Configure and test Google and email Auth on a real deployed origin with two test identities.
4. Continue only with tested, isolated game plugins; do not enable catalogue entries before their plugin artifacts pass the approval process.

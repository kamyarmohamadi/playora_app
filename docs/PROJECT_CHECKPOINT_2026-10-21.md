# Playora Project Checkpoint — 2026-10-21

## Purpose
Persistent handoff note so work can continue from GitHub without restarting.

## Repository and privacy
- Repository: https://github.com/kamyarmohamadi/playora_app
- Verified repository visibility: **private** (GitHub repository metadata checked on 2026-10-21).
- Default branch: `main`.
- Do not change repository visibility unless explicitly requested again.
- Important: private repository visibility limits who can view source, but does not by itself secure a deployed app or protect secrets. Never commit API secrets, private keys, service-role keys, wallet seed phrases, or production credentials.

## Current design direction
- Product: Playora, a global multiplayer/casual games platform.
- Default language: English; Persian language support and RTL layout required.
- Visual direction selected by user: **D (competitive/neon arena)** with **B base + D accents** — social, energetic blue/purple base, neon cyan/purple competitive highlights, richer depth/3D cards and icons (avoid flat, generic-looking UI).
- Priority screen: Home + Games catalogue.
- Navigation requirement: desktop right-side navigation should be collapsed by default and open/close from the hamburger icon (drawer behavior); keep responsive behavior sensible on mobile.
- User explicitly requested to continue from the latest state after errors; do not restart/rewrite from scratch. Inspect current branch/files and resume from the last working commit.

## GitHub branches and pull requests observed on 2026-10-21
Branches observed:
- `main`
- `chore/playora-engineering-skill`
- `feature/playora-platform-shell`
- `feature/playora-dashboard-polish-2026-10-19`
- `feature/playora-neon-ui-member-isolation`
- `fix/playora-v1`
- `fix/preview-build`

Relevant PRs observed:
- PR #5: https://github.com/kamyarmohamadi/playora_app/pull/5 — “Neon Playora redesign and secure member-data foundation”
- PR #4: https://github.com/kamyarmohamadi/playora_app/pull/4 — “Polish Playora dashboard with ten quick-access shortcuts”
- PR #3: https://github.com/kamyarmohamadi/playora_app/pull/3 — “Build responsive Persian RTL Playora app shell”
- PR #2: https://github.com/kamyarmohamadi/playora_app/pull/2 — “Build responsive Persian Playora app shell”
- PR #1 is marked superseded in its description.

PR #5 description says it introduces an English-first Persian-capable neon shell, catalogue filters, favorites filtering, responsive cards, tournament/wallet previews, locale direction switching, a Supabase/Postgres migration with Row-Level Security, a JWT-authenticated `member-self` Edge Function, and security/setup docs. It explicitly states that the migration/function have **not yet been applied/deployed** to a Supabase project and production auth/session management, realtime gameplay, authoritative game rules, payment monitoring and deployment security headers are not complete. Confirm actual branch/PR state before assuming these changes are on `main`.

## Security and product status — do not overclaim
- Treat frontend/local state as untrusted and user-editable.
- Every member-specific read must be authorized server-side and constrained to the authenticated member (e.g. RLS); never rely only on hiding UI elements.
- Wallet balances, ledger entries, match results, tournament results, deposits and prize eligibility must be server-authoritative and protected from client writes.
- Never expose Supabase service-role credentials or other privileged secrets in browser code.
- Online matchmaking/gameplay needs server-side validation, anti-cheat/anti-collusion protections, rate limits and replay/idempotency controls.
- Crypto deposits must only credit after server-side chain/transaction verification and proper confirmation checks; screenshots/user-supplied timestamps alone are not proof of payment.
- Real-money/crypto-funded competitions and redeemable rewards are **not approved for launch** until jurisdiction/product/legal review is complete.
- A successful CI/build or RLS test is evidence only for the tested branch and cases, not a claim of complete security or production readiness.

## Latest known testing notes
PR #4 description reports tests, TypeScript check, and production build passed for that branch. PR #3/#2 descriptions report the shell tests/typecheck/build passed at the time. PR #5 requested CI validation and independent SQL migration review before merge. Re-check latest CI and current PR diffs before merging or deploying.

## Next steps (continue, don't restart)
1. Inspect PR #5 and branch `feature/playora-neon-ui-member-isolation`; identify the last successful commit and latest error/log.
2. Resume from the error point and avoid replacing working features unnecessarily.
3. Finish the selected Home + Games visual system: richer depth, layered surfaces, polished icons, responsive layout, and collapsible right-side desktop navigation.
4. Run tests, TypeScript check, production build, and browser smoke tests after each meaningful change.
5. Review SQL/RLS policies for profiles, wallet/ledger, matches, rooms, deposits, tournament state and social data; add negative tests proving member A cannot read/write member B's data.
6. Keep production secrets out of Git; use deployment secret management.
7. Merge only after review, green checks, and confirming which changes actually belong on `main`.
8. Produce a browser-openable preview only after verifying the exact artifact path in the current session.

## User's explicit instruction
Save progress to GitHub so it can be resumed from any location. Continue from the last working point after errors; do not start over.

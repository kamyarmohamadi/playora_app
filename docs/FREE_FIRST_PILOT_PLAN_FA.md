# Playora — Free-first pilot scope

Reviewed: 2026-10-23  
Working branch: `feature/playora-platform-game-plugin-architecture-2026-10-22`

## Decision

Build the first useful version with a **zero-required-spend** operating model and a pilot target of a few hundred registered members. This is a development target, not a verified concurrency guarantee. Do not add a paid dependency unless the owner explicitly approves it after seeing the actual free-tier limit and the reason the limit blocks the pilot.

## What “free” means for this stage

- No paid hosting, analytics, email, game-server, or monitoring product is required by the source code for local development and CI.
- Prefer free hosting and the free tier of a managed backend only after checking the provider's current quotas, inactivity/sleep behavior, data retention, and upgrade triggers.
- Never assume “free tier” means unlimited, permanently available, or suitable for realtime traffic. Quotas and terms can change.
- No payment gateway, deposits, withdrawals, cash prizes, or real-money wallet operation in the pilot.
- No game plugin is enabled until its runtime, server-side rules, security, and recovery paths are verified.
- Never put service-role keys, private tokens, or provider secrets in frontend code, repository files, or load-test commands.

## Pilot release gates

### Gate A — Free local preview
- [x] The app has a local catalog fallback when Supabase is not configured.
- [x] The shell and navigation have automated UI tests.
- [x] Game modules are separated from platform shell and unapproved plugins cannot launch.
- [ ] Run the current branch's full CI successfully; recent runs have failed before any job steps, so the latest changes are not yet verified.
- [ ] Confirm the local development flow from a clean checkout using the lockfile.

### Gate B — Free hosted, read-only preview
- [ ] Choose a free static host and document its current quota/limitations before publishing.
- [ ] Verify production build, HTTPS, route fallback, mobile layout, English and Persian/RTL.
- [ ] Verify the public game catalog works without leaking member data.
- [ ] Confirm no environment secrets are bundled into client assets.
- [ ] Add a clear preview label; keep all game launch, wallet, room creation and payments disabled unless their backend gates pass.

### Gate C — Small member pilot
- [ ] Verify email sign-in/session refresh/logout with two separate test accounts.
- [ ] Run two-user isolation checks for profile, social graph, private rooms, history and support reports.
- [ ] Check the selected backend's current free quotas and behavior at inactivity, rate limits, and quota exhaustion.
- [ ] Run the read-only catalog k6 test at 10, 25, 50, then 100 virtual users against an isolated staging project; stop on unexpected errors or quota warnings.
- [ ] Test burst behavior and record p50/p95/p99, request failure rate, and provider usage.
- [ ] Invite only a small, controlled group after these gates pass; expand toward a few hundred members based on evidence.

### Gate D — Online gameplay (not enabled yet)
- [ ] Server-authoritative match state and validation; never trust a client's claimed move or result.
- [ ] Room lifecycle, Ready state, reconnect, stale-session cleanup and abuse limits.
- [ ] Realtime authorization and fan-out measured under realistic room sizes.
- [ ] Duplicate/replayed move and transaction tests.
- [ ] A game-specific release checklist and a rollback path.

## Initial capacity language

The initial pilot target is **a few hundred registered accounts**. Registered accounts are not the same as simultaneous active users. Before testing, do not advertise a specific number of concurrent players. The current k6 script tests only public catalog reads; it does not certify sign-in, private data, rooms, realtime chat, or gameplay.

For a low-cost first pilot, use staged testing at 10–100 virtual users and keep the script's hard cap at 500 VUs. Do not run load tests against production or a shared project. Higher targets require an isolated environment, provider quota review, and a planned test window.

## What is deliberately deferred

- 100,000 concurrent sessions.
- Real-money payments, deposits, withdrawals and prizes.
- Enabling games before each game has trusted, server-side rules.
- Paid scaling services before measurements show they are necessary.
- Any statement that a release gate passed without a run, result, or review record.

## Current blockers

1. GitHub Actions jobs have recently failed before executing any steps (no runner assigned in the observed attempts). This does not prove the code failed, but it also means the latest changes have no CI pass.
2. The new capacity indexes have not been verified by a successful database test run or realistic query plan.
3. No staging load-test result has been captured.
4. Live auth/RLS verification with two browser accounts remains outstanding.

## Working rule

Every meaningful change must be saved on the working branch, and the checkpoint/checklist updated. Keep `main` untouched. A code commit is not evidence of deployment or production readiness.

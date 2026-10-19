# Playora production-readiness checklist

This is a release gate, not a claim that Playora is deployed. Keep the account-deletion feature flag off and keep deposit, paid-entry, tournament-prize and convertible-reward flows disabled until each section below is accepted.

## 1. Environments and secrets

- [ ] Create separate Supabase development/staging and production projects.
- [ ] Record the exact project reference and production origin in the deployment record; never store access tokens in source control.
- [ ] Configure hosting environment variables **VITE_SUPABASE_URL** and **VITE_SUPABASE_ANON_KEY** with the project's public URL and publishable/anon key only.
- [ ] Keep **SUPABASE_SERVICE_ROLE_KEY** exclusively in server-side Edge Function secrets. Never use a VITE_ prefix for service credentials and never send a service-role key to the browser.
- [ ] Set **PLAYORA_ALLOWED_ORIGINS** to an explicit comma-separated allowlist of exact HTTPS frontend origins for the Edge Functions. Do not use a wildcard.
- [ ] Confirm local .env files, private keys, seeds and project secrets are absent from Git history and build artifacts.

## 2. Database migrations and authorization

- [ ] Review the migrations in timestamp order, then apply them to a clean staging project using the Supabase CLI.
- [ ] Confirm the tables and RPCs exist, all member-owned tables have RLS enabled, and no privileged function is executable by anon.
- [ ] Use two distinct real staging accounts. Attempt cross-member reads/writes by replacing user IDs in requests for profiles, preferences, favorites, wallet, ledger, match results, rooms, relationships and deposit requests. Every unauthorized access must fail or return no rows.
- [ ] Verify that member_profiles.user_id, username, coin balances, ledger rows, match state, participant results, XP/rating and deposit status cannot be edited directly by an authenticated client.
- [ ] Verify idempotent wallet-operation keys reject conflicting replays, duplicate calls do not double-credit, and insufficient balances cannot become negative.
- [ ] Test account cleanup and actual Auth Admin deletion with disposable accounts; confirm unfinished matches are cancelled, rewards are not assigned, host rooms and private records cascade as expected, and surviving users retain no false win/loss.
- [ ] Run security_invariants.sql, wallet_ledger.sql, rls_member_isolation.sql, ranked_tictactoe.sql, private_rooms.sql, social_leaderboard.sql and account_deletion.sql against the staging schema.

## 3. Authentication and account lifecycle

- [ ] Configure the production Site URL and exact allowed redirect URLs for email confirmation, password recovery and Google OAuth.
- [ ] Enable email confirmation, password policy (minimum 12 characters), abuse/rate limits and account recovery. Register Google OAuth credentials only in Supabase/provider secret settings.
- [ ] Test sign-up, sign-in, sign-out, expired sessions, password reset, email confirmation and OAuth error paths on desktop and mobile browsers.
- [ ] Confirm guest users cannot invoke matchmaking, social RPCs, private rooms or account deletion.
- [ ] Keep account deletion disabled until the delete-account Edge Function is deployed with secrets and tested end-to-end. Enable VITE_ACCOUNT_DELETION_ENABLED=true only after the staging deletion test passes.
- [ ] Validate the recent-authentication requirement, exact DELETE confirmation, body limit, allowed-origin rejection, retry behavior after cleanup succeeds but Auth Admin deletion fails, and cleanup of browser-local state after successful deletion.

## 4. Edge Functions and hosting

- [ ] Deploy member-self and, only after the account-deletion gate passes, delete-account with the Supabase CLI.
- [ ] Check both Edge Functions with Deno using their own deno.json import maps.
- [ ] Configure the hosting provider to enforce headers from public/_headers or equivalent, including a tested Content Security Policy, frame restrictions, MIME-sniffing protection and HTTPS/HSTS where applicable.
- [ ] Test the effective CSP against the deployed origin, Google Fonts (or self-hosted replacement), Supabase REST/Auth endpoints and Supabase WebSocket endpoint if real-time transport is enabled.
- [ ] Verify production source maps, client bundles and browser network requests contain no service-role key, private token, seed phrase, wallet private key or other server-only secret.
- [ ] Configure backups, restore drills, uptime/error alerts and security incident contacts before launch.

## 5. Game integrity and privacy

- [ ] Verify ranked matchmaking selects opponents server-side and suppresses recent repeats; clients cannot choose a ranked opponent or forge rating.
- [ ] Verify all Tic Tac Toe moves are checked against authoritative state, current turn, membership, game status and state version; duplicate/out-of-turn/occupied-cell moves are rejected.
- [ ] Confirm practice and private matches never change XP, competitive rating, coin balances or prizes.
- [ ] Confirm one participant can read only their own match_participants row. Opponent auth UUIDs and host auth UUIDs must not be returned from browser-facing queries.
- [ ] Confirm friend requests use usernames (never searchable email addresses), limits are server-side, blocked relationships cannot be recreated, and leaderboard responses contain only intended public profile fields.
- [ ] Test reconnects, cancelled queues, stale queues, simultaneous joins, expired/closed room codes, repeated room-join requests, draw/win results and abandoned matches.

## 6. Release scope

The current branch has an implemented Tic Tac Toe practice engine and server-authoritative ranked/private Tic Tac Toe flows. Other catalogue games, real-time WebSocket transport, crypto deposit confirmation, paid entry, tournament payouts and prize fulfillment are not production-enabled.

- [ ] Keep unfinished catalogue games clearly marked unavailable.
- [ ] Keep deposits, paid entry, rewards convertible to money/gift cards and prize tournaments disabled until payment verification, anti-fraud limits, reconciliation, legal approval and support workflows are independently reviewed.
- [ ] Verify dependency audit, unit tests, TypeScript, production build, Edge Function type-check and all PostgreSQL CI tests are green on the exact release commit.
- [ ] Obtain a separate human security review against the actual Supabase project. Green CI is necessary but not sufficient for launch.

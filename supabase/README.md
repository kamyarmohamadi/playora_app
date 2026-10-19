# Supabase setup — Playora

This folder is the backend foundation, not a claim that a live backend already exists.

## 1. Create an isolated development project

1. Create a Supabase project for development and keep production in a separate project.
2. Keep the project URL and publishable/anon key in environment variables for the browser app only.
3. Keep the service_role key exclusively in server-side secrets. Never prefix it with VITE_ and never commit it.
4. Apply migrations/20261020000000_secure_member_data.sql to the development database after inspecting the SQL and comparing it with any existing schema.
5. Enable email confirmation, configure allowed redirect URLs, password policy, rate limits and abuse detection in Supabase Auth.
6. Test using two real test accounts. Attempt to read each other's profile, wallet, ledger, favorites, deposits, rooms and match data by substituting UUIDs. All cross-member reads and writes must be denied.

## 2. Environment variables

The future frontend integration should use a local .env.local containing:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

Add .env.local, .env.*.local, server secrets and local key material to .gitignore. An anon/publishable key is not a secret, but its safety depends on RLS. A service-role key bypasses RLS and must never reach browser code.

## 3. What the schema intentionally blocks

Browser clients cannot create wallet credits, edit ledger entries, set a payment to credited, create authoritative matches or choose winners. Implement these as reviewed server-side operations only. A client must never be allowed to send a user_id and amount and thereby credit its own account.

## 4. Still required before production

- Auth UI and session lifecycle connected to Supabase, plus account recovery and email verification.
- Server-owned, idempotent wallet transaction functions and an audited ledger.
- An on-chain watcher/provider for each supported network, with confirmation/reorg policy and a reconciliation workflow. A user-provided screenshot or transaction timestamp is not proof of payment.
- Server-authoritative rules for each game and a real-time session protocol.
- Secure matchmaking, friendship/room APIs, ranking/XP calculations, abuse controls and anti-collusion detection.
- Tested RLS policies, integration tests, rate limits, monitoring, incident response, retention/deletion workflows and actual production headers.
- Legal approval before enabling paid entry or convertible rewards in a market.

Do not enable deposit and reward controls in the frontend until the relevant server operation is deployed and tested end-to-end.

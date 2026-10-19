# Supabase setup — Playora

This folder is the backend foundation, not a claim that a live backend already exists.

## 1. Create an isolated development project

1. Create a Supabase project for development and keep production in a separate project.
2. Keep the project URL and publishable/anon key in environment variables for the browser app only.
3. Keep the service_role key exclusively in server-side secrets. Never prefix it with VITE_ and never commit it.
4. Apply migrations/20261020000000_secure_member_data.sql to the development database after inspecting the SQL and comparing it with any existing schema.
5. Enable email confirmation, configure allowed redirect URLs, password policy, rate limits and abuse detection in Supabase Auth.
6. Set the Edge Function secret PLAYORA_ALLOWED_ORIGINS to a comma-separated allowlist of exact HTTPS frontend origins (plus localhost during local development). Do not use a wildcard. The member-self endpoint rejects browser origins not on the allowlist.
7. Test using two real test accounts. Attempt to read each other's profile, wallet, ledger, favorites, deposits, rooms and match data by substituting UUIDs. All cross-member reads and writes must be denied.

## 2. Environment variables

The future frontend integration should use a local .env.local containing:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

Add .env.local, .env.*.local, server secrets and local key material to .gitignore. An anon/publishable key is not a secret, but its safety depends on RLS. A service-role key bypasses RLS and must never reach browser code.

## 3. What the schema intentionally blocks

Browser clients cannot create wallet credits, edit ledger entries, set a payment to credited, create authoritative matches or choose winners. Implement these as reviewed server-side operations only. A client must never be allowed to send a user_id and amount and thereby credit its own account.

## 4. Database invariant check

After applying the migration to a disposable test database, run `psql -v ON_ERROR_STOP=1 -f supabase/tests/security_invariants.sql` with an administrator connection. This checks that RLS is enabled and that authenticated clients have no direct write privileges on authoritative wallet/payment/match tables. It is a static privilege check; also perform actual two-user integration tests in Supabase.

## 5. Still required before production

- Auth UI and session lifecycle connected to Supabase, plus account recovery and email verification.
- Server-owned, idempotent wallet transaction functions and an audited ledger.
- An on-chain watcher/provider for each supported network, with confirmation/reorg policy and a reconciliation workflow. A user-provided screenshot or transaction timestamp is not proof of payment.
- Server-authoritative rules for each game and a real-time session protocol.
- Secure matchmaking, friendship/room APIs, ranking/XP calculations, abuse controls and anti-collusion detection.
- Tested RLS policies, integration tests, rate limits, monitoring, incident response, retention/deletion workflows and actual production headers.
- Legal approval before enabling paid entry or convertible rewards in a market.

Do not enable deposit and reward controls in the frontend until the relevant server operation is deployed and tested end-to-end.

The file `public/_headers` is a security-header template for static hosts that support the `_headers` convention (for example, compatible Cloudflare Pages/Netlify deployments). It is not automatically enforced on every host; configure equivalent headers in the selected production host and test the effective Content-Security-Policy with the actual Supabase project URL.

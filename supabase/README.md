# Supabase setup — Playora

This folder documents a backend foundation. It is not evidence that a live Supabase service has been provisioned or deployed.

## 1. Create a development project first

1. Create a separate Supabase project for development and production; do not test against production data.
2. In Auth, enable email confirmation and configure secure redirect URLs. Configure Google OAuth credentials in Supabase Auth before enabling the Google button.
3. Create a local .env.local from .env.example and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. These are browser configuration values, not service-role credentials.
4. Keep the service_role key exclusively in server-side secrets. Never prefix it with VITE_, expose it in browser code or commit it.
5. Apply migrations in order to a fresh or reviewed compatible project:
   - supabase/migrations/20261020000000_secure_member_data.sql
   - supabase/migrations/20261020010000_private_rooms.sql
6. Only Tic Tac Toe is implemented for server-connected play in this iteration. Other catalog games remain disabled. Do not manually enable incomplete games.
7. Deploy the authenticated self-service endpoint with: supabase functions deploy member-self.
8. Set the Edge Function secret PLAYORA_ALLOWED_ORIGINS to a comma-separated list of exact HTTPS frontend origins (and localhost for local development). Do not use a wildcard.
9. Test email signup/confirmation, sign-in, password recovery and OAuth redirects against this exact project.

Do not run supabase db push or apply these migrations to an existing project until table names, policies, extensions and migration conflicts have been reviewed and backed up.

## 2. Member-data isolation tests

Run the included PostgreSQL tests in the workflow, or against a disposable PostgreSQL database:

    psql -v ON_ERROR_STOP=1 -f supabase/tests/bootstrap_supabase.sql
    psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261020000000_secure_member_data.sql
    psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261020010000_private_rooms.sql
    psql -v ON_ERROR_STOP=1 -f supabase/tests/security_invariants.sql
    psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_member_isolation.sql
    psql -v ON_ERROR_STOP=1 -f supabase/tests/ranked_tictactoe.sql
    psql -v ON_ERROR_STOP=1 -f supabase/tests/private_rooms.sql

The included bootstrap is a test-only minimal auth schema shim. It does not replace integration tests against real Supabase Auth/JWTs. In the real project, use at least two distinct authenticated test accounts and attempt cross-member reads/writes by substituting UUIDs. Verify that all cross-member access is denied.

## 3. Wallet and payment boundary

Browser clients cannot create wallet credits, edit ledger entries, mark a payment verified, or set match winners/rankings. The apply_coin_delta RPC is server-role-only, transactional and idempotent. Do not call it from the browser or expose a service-role key. A real payment processor/on-chain watcher, idempotent transaction reconciliation and incident workflow are not implemented yet; do not enable deposits.

Private-room invite codes are generated randomly; only a SHA-256 hash is persisted. The hash helper resolves the installed pgcrypto schema at runtime because Supabase commonly installs extensions in the extensions schema while local PostgreSQL may use public.

## 4. Release gate

Before production, also complete: real Supabase RLS integration tests, rate limits and abuse controls, monitoring/logging without secrets, backups/recovery, data retention/deletion workflows, dependency/security scans, actual hosting security headers and an independent threat-model review. Do not enable paid entry or prize payouts before server controls and market-specific legal approval.

public/_headers is a template for compatible static hosts only. It is not automatically enforced on every hosting provider; configure equivalent headers on the selected host and test the effective CSP against the actual Supabase URL.

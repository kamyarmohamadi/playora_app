# Playora security model

## Current implementation status

This branch contains a redesigned React/Vite frontend and a Supabase/Postgres migration that establishes row-level security boundaries. It is not yet a production service: no Supabase project has been connected, no live login/session flow has been configured, no Edge Functions have been deployed, and game engines, real-time matchmaking, crypto payment monitoring and prize fulfillment are not live.

The private GitHub repository is source control only; it does not authenticate Playora members or isolate their records at runtime.

## Data separation

- Authentication identity: Supabase Auth (auth.users); never expose service-role credentials in browser code.
- Private profile and preferences: member_profiles and member_preferences, scoped to auth.uid().
- Wallet: coin_wallets; a member may read only their row. Clients cannot insert, update, or delete a wallet.
- Ledger: coin_ledger; immutable from client roles and readable only by the owning member.
- Favorites: only the signed-in member's rows may be read, added, or removed.
- Matches and rooms: users may read matches they participate in and rooms they host/join. Client roles have no write policies for match state, room membership, or results.
- Deposits: users may read only their own deposit requests; they cannot mark a transfer as verified or a balance as credited.
- Friend requests, tournament entries and audit events are not client-writable in this foundation; write operations must be exposed via separately reviewed server functions.

## Required server-side rules

1. Derive the member ID from a verified Supabase JWT (auth.uid()); never accept a client-supplied user_id as authority.
2. Revalidate authorization and the state transition for every request. Never trust a balance, winner, level, XP, rating, match result, transaction hash, deposit confirmation, tournament place, or client clock supplied by a browser.
3. Perform wallet writes in a database transaction on a trusted server path. Use idempotency keys, unique constraints, non-negative balance constraints and an immutable ledger. Never ship the service-role key.
4. Matchmaking and game state transitions must be server-authoritative, deterministic where appropriate, and covered by tests for legal and illegal moves.
5. Validate every request schema; cap body sizes; rate-limit sign-in, friend requests, room creation and deposit-intent creation; use structured logs without passwords, access tokens, seed phrases or full payment credentials.
6. Apply production security headers at the actual hosting layer. The CSS import of Google Fonts is external; CSP must explicitly account for it or use self-hosted fonts.
7. Add abuse controls for multiple accounts, signup-bonus farming, collusion, replayed moves, repeated deposits and suspicious result patterns before enabling rewards.
8. Keep prize-bearing tournaments and any convertible/transferable currency disabled until the exact business model is approved for each market.

## Database migration notes

supabase/migrations/20261020000000_secure_member_data.sql enables RLS on every table created by the migration and intentionally omits client write policies for authoritative tables. It seeds the catalogue with is_enabled = false; that prevents server/catalog queries from announcing unfinished games as live.

The migration creates a signup trigger that allocates 50 free demo coins. Before deploying it, confirm that this bonus is desired for the production account lifecycle and add anti-abuse constraints for repeat accounts. The trigger uses a generated username, rather than a user-provided identifier.

Apply the migration to a new/test Supabase project first and test the policies with at least two distinct authenticated users. Check both normal reads and deliberate cross-user ID substitution. Do not deploy to an existing database without reviewing object names and migration conflicts.

## Release gate

Do not describe the service as secure or production-ready until: database RLS is tested; Auth and email/phone verification are configured; server functions are deployed; game rules/matchmaking have authoritative tests; dependency, secret and security scans run in CI; hosting headers are active; backups/recovery/monitoring are configured; and a qualified reviewer has checked the threat model.

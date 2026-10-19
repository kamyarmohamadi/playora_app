# Playora

Playora is a global, English-first competitive game platform concept with Persian localization. The current feature branch contains a neon competitive-arena interface and the first Supabase/Postgres data-isolation migration.

## Run the frontend

Requirements: Node.js compatible with the pinned Vite toolchain.

    npm ci
    npm test
    npm run typecheck
    npm run build
    npm run dev

## Current scope

The frontend is a design preview. It includes the home dashboard, game catalogue and filters, favorites, tournament view, wallet preview, profile/settings layout, and English/Persian direction switching. Cards and tournament items are explicitly labeled as preview/coming soon.

Not live in this branch: account registration/login, persistent user sessions, deployed backend, real game engines, server-authoritative multiplayer, matchmaking, public ranking, friend invitations, rooms, crypto deposit monitoring, wallet-credit operations, prize fulfillment, production deployment or CSP/security headers.

## Security

See docs/SECURITY_MODEL.md and supabase/README.md. The migration scopes member data with RLS and denies client-side writes to authoritative wallet, match, room, tournament and payment state. It requires a Supabase project, schema review, two-user isolation tests and server functions before it can be considered operational.

Never place passwords, service-role keys, wallet seed phrases or private keys in frontend code or source control. Do not enable rewards or paid-entry tournaments until their server-side controls and market eligibility are approved.

# Playora Admin Console and RBAC — Requirements

Status: design requirements only. The admin console is not yet deployed or production-operational. Implement incrementally on the current feature branch; do not rebuild Playora from scratch.

## Goal
Create a private owner/admin console for support tickets and diagnostics, member account assistance, deposit review, moderation, incident management, staff permissions and developer workflow. Staff access must be least-privilege, server-enforced, time-limited where possible and audited.

## Essential rule
Do not let staff log in with a member's password or secretly take over a member session. Never show passwords, access/refresh tokens, cookies, recovery codes, wallet seed phrases or private keys. Default to a minimized support view and member-provided sanitized diagnostic bundle. Any future assisted session must require explicit member consent, show a visible banner, be time-limited, read-only by default, revocable and audited.

## Roles
- Owner: manage staff roles/permissions, feature flags, operational overview and approved emergency workflow. MFA, step-up authentication and audit are mandatory; owner actions are not exempt from logs.
- Support Agent: search by member ID/username/ticket reference; see minimal support fields, relevant app version/error summary and ticket history; reply and request diagnostics. Cannot change wallets, ratings, match results, verification status, staff roles or production settings.
- Support Supervisor: manage assignments, merge/split related tickets, escalate incidents and request controlled read-only support access. No direct wallet or match edits.
- Finance/Deposit Reviewer: inspect deposit cases and trusted server-side verification evidence; accept/reject within a workflow. Cannot directly edit balances, verify a payment from a screenshot alone, alter match results or grant staff permissions.
- Game Operations/Moderator: investigate abuse reports and use explicitly granted reversible moderation actions. Permanent bans or prize-affecting actions require reason and elevated approval.
- Developer: work via GitHub feature branches, pull requests and CI; use staging/synthetic data. No routine production member-data, wallet, payment or role-management access.
- Security/Auditor: read approved security events and privileged-action trails; read-only by default.
- Analyst: aggregate and anonymized metrics only.

## Console sections
1. Overview: service health, open critical incidents, report queue and recent deployments.
2. Support inbox: individual tickets, replies, status, assignment, priority and linked duplicate/incident.
3. Member support view: minimal account state and related safe diagnostics; no credentials or unrelated private data.
4. Bug/incident center: sanitized errors, correlation IDs, versions, affected count, first/last seen, linked fix and recurrence.
5. Deposit review: asset/network, claimed transaction hash, server-verified transaction state and reconciliation.
6. Wallet audit: read-only immutable ledger. Fix mistakes through compensating ledger entries, never destructive edits.
7. Match operations: queue/room state and dispute evidence; outcomes remain server-authoritative.
8. Moderation and abuse reports.
9. Staff, roles, permission grants, MFA state and session revocation.
10. Security/audit trail, feature flags and system health. Never show secret values.

## Security design
- Use explicit permission keys rather than one broad is_admin flag. Enforce every permission in server code and database policies; hiding a button is not security.
- Use separate named staff identities, MFA/passkeys, short sessions, re-authentication for sensitive actions, least privilege and rapid session revocation.
- Every privileged request validates staff identity, active status, permission, target, request schema and reason/ticket on the server.
- Log sensitive reads as well as writes: actor, server timestamp, permission, action, target opaque ID, reason/ticket, outcome, correlation ID and approval chain. Keep the audit trail append-only for application roles.
- Role changes, account deletion, bans, manual financial corrections, prize changes and other high-impact actions require step-up authentication; use two-person approval where feasible.
- Keep service-role keys and production secrets only in server-side secret storage. Never place them in browser variables, logs, tickets or Git.
- Developers should use staging data and reviewed pull requests; production deployment and schema changes require automated checks and approval.

## Member-account assistance
Support should inspect only fields necessary to diagnose the specific ticket. Account recovery must use official reset/verification flows; staff cannot view/set a member's existing password. If an assisted session is ever added, it must be explicit, visible to the member, scoped, read-only by default, expire automatically and be logged. Financial actions are prohibited inside support sessions.

## Deposit and wallet controls
Clients cannot create credits, verify deposits, edit ledger entries or set coin balances. Crypto transfers require server-side network/asset/destination/amount/confirmation verification and replay protection. Finance staff review the trusted result but cannot fabricate chain verification. Corrections create new compensating ledger entries with reason; high-impact adjustments require a second approver and alert.

## Support tickets and one-off bugs
Preserve each member report separately. Group reports into a shared engineering incident only when technical fingerprints support the same cause; do not merge by title alone. A unique one-member bug remains an individual case. Capture sanitized app version, platform, route template, error code/stack, request ID and a small safe breadcrumb buffer. Redact tokens, cookies, credentials and private keys. Deduplicate alerts by incident, while preserving all tickets.

## Required test gates
- Support users cannot read unrelated tickets or unrestricted member profiles.
- Developers cannot access production member data, wallet writes, deposits or role management by default.
- Members cannot read another member's support reports, diagnostics or replies.
- Finance cannot directly change balances or mark unverified transactions as paid.
- Frontend cannot authorize privileged actions; server rejects forged role/member IDs.
- Expired/revoked staff grants fail; MFA/step-up requirements are enforced.
- Sensitive actions and reads create immutable audit events.
- No secret appears in client bundles, diagnostics, logs or source control.
- Use at least two test accounts and positive/negative permission tests against a real staging Supabase project.

## Current boundary
The existing Playora branch documents an initial Supabase/Postgres security foundation, but the current project docs say no live Supabase project is connected and the migrations/Edge Functions are not deployed. This file describes intended architecture, not an already running admin panel. Reconcile the current schema before implementing migrations.
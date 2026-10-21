# Playora Support and Bug Diagnostics

Status: design specification only; not yet a live support service.

## Core behavior
Every member report remains an individual ticket. Similar reports may be linked to a shared engineering incident only when diagnostics support a common cause. A unique bug affecting one member remains its own case. Preserve each ticket and response even when grouped.

## Member report form
Provide Report a Problem in Help/Settings and on error screens. Capture category, title, description, expected behavior, reproduction steps, impact, optional screenshot and consent/notice for diagnostics. Return an opaque reference and status. Allow a safe guest report path for blocking problems. Never ask for passwords, tokens, recovery codes, seed phrases, private keys or payment credentials.

## Safe diagnostics
Capture app version/release, browser/OS family, locale, route template, sanitized error/stack, API operation, server timestamp, request/correlation ID, and a small bounded buffer of safe breadcrumbs. Capture frontend exceptions, unhandled promise rejections, React error boundary events, API failures and server-side exceptions. Redact secrets on client and server. Never persist passwords, auth tokens, cookies, authorization headers, private keys, seed phrases, payment secrets, private chat text or unnecessary precise location data.

## Grouping and prioritization
Keep member reports, diagnostic events and engineering incidents separate. Fingerprint by normalized error/code, sanitized stack, operation/component, route template, release and platform; remove volatile IDs/timestamps. Do not group by free-text title alone. Security leaks, account compromise and wallet/ledger integrity failures require protected triage. Example: 800 matching crash reports can appear as one incident with 800 linked tickets while preserving the other distinct reports individually.

Severity levels: P0 critical (data exposure, account takeover, unauthorized wallet mutation, widespread result corruption); P1 high (widespread login/game/matchmaking failure); P2 normal (isolated functional bug with workaround); P3 low (cosmetic/translation). Deduplicate alerts per incident/escalation, not per event.

## Internal console
Support staff need a grouped incident queue and an ungrouped ticket queue, search, filters, sanitized diagnostics, affected counts, first/last seen, status, assignment, replies, merge/split, linked fix/release, recurrence trends and time-to-acknowledge/resolve metrics. Enforce staff roles server-side, audit privileged access, and avoid exposing unrelated profile, wallet, token or private-message data.

## Persistence and permissions
Suggested entities: support_reports, diagnostic_events, incidents, support_replies, support_audit_log and notification_outbox. Members can read only their own reports/replies. Clients cannot set staff severity/status/assignee, verify deposits, write audit records, or mutate wallet/match state. Ingest via a trusted, validated, rate-limited server endpoint. Use idempotency keys and durable notification retries. Reporting outages must not block gameplay.

## Acceptance gates
- Individual unique bugs stay distinct; validated duplicates are linked, not deleted.
- 1,100 synthetic reports can persist and be triaged; retries do not double-count.
- Cross-member ticket and diagnostic reads are denied.
- Redaction tests prove secrets never persist.
- Notifications retry without losing tickets; P0/P1 alerts are deduplicated.
- Report failures do not block gameplay.
- Test policies against an actual staging Supabase project before production.

## Project boundary
This is a design spec. Playora repository documentation says no live Supabase project is connected or deployed. This file does not mean diagnostics, incident aggregation, notifications, or a support dashboard are operational.
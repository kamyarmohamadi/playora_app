# Playora Admin Console — Reviewed Preview

**Review checkpoint:** 2026-10-22  
**Status:** standalone UI prototype; not a production administration service.

## Files
- `Playora_Admin_Preview_Owner_Access.html` — main responsive preview.
- `Playora_Admin_Preview_Desktop_v3.html` — desktop-oriented preview.
- `Playora_Admin_Preview_Mobile_v3.html` — mobile layout preview.
- `Playora_Admin_Team_Access_Desktop.html` — opens on Team & Permissions.
- `Playora_Admin_Team_Access_Mobile.html` — mobile version of Team & Permissions.
- `ADMIN_CONSOLE_RBAC.md` — role and access security requirements.
- `SUPPORT_AND_INCIDENT_SYSTEM.md` — bug reports, diagnostics, incident grouping and support workflow.
- `REVIEW_REPORT.md` — checks performed and remaining limitations.
- `PROJECT_CHECKPOINT.md` — continuation status.

## Open the preview
Download an HTML file and open it with a current desktop browser. For mobile, use the mobile variant; browsers that restrict local HTML/JavaScript can use a local static server or the accompanying ZIP/PDF/PNG snapshots saved in the ChatGPT Library.

## Included prototype interactions
The local demo shows a locked `owner-root` row, fake staff invite flow, role/capability editor, suspend/reactivate controls and sample audit entries. The demo may use browser localStorage.

## Security boundary
This is not a live admin panel. No real staff sign-in or invitation emails, backend-enforced permissions, database-backed persistence, live support tickets, verified deposits, or production audit pipeline are connected. Local browser state and JavaScript are editable and must never authorize real actions. Production must enforce permissions in trusted backend functions and database policies, secure owner bootstrapping, MFA, auditable actions and negative access tests.

## Source of truth
This preview is stored on branch `feature/playora-admin-preview-reviewed-2026-10-22` under `docs/admin-preview/reviewed-2026-10-22/`. It has not been merged into `main` and is intentionally separate from the production React/Vite app.

# Playora — Exact Migration Ledger Reconciliation Plan

**Audit date:** 2026-11-01  
**Project:** `playora-dev` (`nnowvfewtrfurnluhflt`)  
**Organization plan:** Free  
**Git branch:** `feature/playora-platform-game-plugin-architecture-2026-10-22`

## Safety decision

No database schema, migration history, user records, wallet balances, or Auth settings were changed in this phase.

**Do not run `supabase db push` until the backup has been exported and this ledger plan has been reviewed against the output of `supabase migration list --remote=nnowvfewtrfurnluhflt`.** Do not edit `supabase_migrations.schema_migrations` manually with SQL.

## 1. Why the migration history is out of sync

Supabase's CLI compares migration **timestamps**, not migration names. The live project currently has 22 history rows and 19 distinct names, while the repository has 24 migration files. The 19 old live migration names map to the first 19 local files, but each live row has a generated remote version timestamp that differs from the timestamp prefix of its corresponding Git file. Three migration names have two remote rows each.

This means a normal CLI migration list will see version mismatches even when the migration's SQL effects are already present. The official CLI docs state that timestamp values are compared and that `migration repair` changes only the history table; it does not execute or reverse SQL.

References:
- [Supabase CLI migration list](https://supabase.com/docs/reference/cli/supabase-migration-list)
- [Supabase migration repair and sync troubleshooting](https://supabase.com/docs/guides/deployment/database-migrations)
- [Current CLI release notes for remote targets and hosted mutation consent](https://github.com/supabase/cli/releases)

## 2. Live remote rows mapped to local migration files

| Remote version | Remote name | Local file version | Finding |
|---|---|---|---|
| `20261021221235` | `20261020000000_secure_member_data` | `20261020000000` | Core member schema present |
| `20261021221238` | `20261020010000_private_rooms` | `20261020010000` | Private-room objects present |
| `20261021221241` | `20261020020000_social_and_leaderboard` | `20261020020000` | Social objects present; local source now rejects anonymous sessions |
| `20261021221244` | `20261020030000_limit_match_uuid_visibility` | `20261020030000` | Mapped by exact name |
| `20261021221246` | `20261020040000_account_deletion` | `20261020040000` | Mapped by exact name |
| `20261021221609` | `20261021000000_platform_only_disable_game_rpc` | `20261021000000` | Platform-only game lockdown present |
| `20261021222935` | `platform_game_plugin_registry` | `20261022000000` | Catalogue/plugin tables present |
| `20261021223140` | `plugin_registry_hardening` | `20261023000000` | Registry indexes/SDK constraint present |
| `20261021223334` | `plugin_registry_hardening` | `20261023000000` | Second row under same name |
| `20261021224238` | `20261023000100_plugin_origin_state_guards` | `20261023000100` | Mapped by exact name |
| `20261021224609` | `20261024000000_catalog_art_key` | `20261024000000` | Mapped by exact name |
| `20261021224739` | `20261023000200_registry_origin_actor_index` | `20261023000200` | Mapped by exact name |
| `20261021230440` | `20261025000000_plugin_capability_grants` | `20261025000000` | Mapped by exact name |
| `20261022210510` | `20261026000000_support_reports` | `20261026000000` | Support table present |
| `20261030234819` | `capacity_query_indexes` | `20261027000000` | Mapped by exact name |
| `20261030234821` | `player_progression_economy` | `20261031000000` | Member progression/wallet objects present |
| `20261030235027` | `wallet_default_55` | `20261031000100` | Mapped by exact name |
| `20261031003308` | `economy_tracks_and_value_signup_gift` | `20261031000200` | Free/Paid columns, keys and indexes present |
| `20261031003317` | `economy_tracks_and_value_signup_gift` | `20261031000200` | Second row under same name |
| `20261031003726` | `seed_both_game_tracks` | `20261031000300` | Both tracks seeded; catalogue seed trigger present |
| `20261031003752` | `seed_both_game_tracks` | `20261031000300` | Second row under same name |
| `20261031005556` | `manual_financial_flows_and_turnover` | `20261031000400` | Financial-flow tables present |

The duplicate rows are history duplicates, not duplicate primary-key versions. The current SQL files for the three repeated migrations use idempotent patterns (conditional constraints, `IF NOT EXISTS`, replaceable functions/triggers, and conflict-safe data inserts). The live object checks found the expected key side effects:

- Plugin hardening: both creator/reviewer indexes and the ordered SDK range constraint exist.
- Economy split: all four `economy_mode` columns, the Free/Paid key/indexes, and the match-mode guard are present.
- Track seeding: 16 Free rows and 16 Paid rows exist (2 members × 8 games); there are no member/game pairs missing one of the two tracks. The catalogue-insert trigger and function exist.

The branch CI will also replay these three files twice in a disposable PostgreSQL database to verify current-file replay safety. That does not prove the historical SQL bodies for both remote invocations were byte-identical; it verifies that the committed versions can be safely replayed.

## 3. Five local migrations that are genuinely pending

These files are not represented in the live migration ledger, and their expected critical objects are absent:

| Local file | Expected live effect | Current live state |
|---|---|---|
| `20261031000500_private_finance_admin_control_plane.sql` | `platform_admin_members`, `platform_admin_audit_events` | Both absent |
| `20261031000600_financial_fk_indexes.sql` | 14 finance FK indexes and one redundant index removal | 14 unindexed FK findings remain |
| `20261101000000_enforce_verified_deposit_withdrawal_minimum.sql` | Reject withdrawals until cumulative credited deposits reach 500 coins | Current RPC lacks this check |
| `20261101000100_signup_device_ip_guard.sql` | Private signup HMAC/device/IP tables and Auth hook function | Private schema and objects absent |
| `20261101000200_reject_anonymous_social_and_leaderboard_rpcs.sql` | Explicit anonymous-session rejection in four member-only RPCs | Not deployed; source is CI-tested |

These five files must be run once, in timestamp order, only after history normalization.

## 4. Backup requirements for this Free-plan project

Supabase's current Backups guide says automatic daily backups are provided for Pro, Team and Enterprise plans; Free projects should export their data using `supabase db dump` and maintain off-site copies. A read-only live check found:

- Auth users: 2
- Storage buckets: 0
- Storage objects: 0
- Public game/finance tables exist, but there are no actual deposit claims or withdrawal requests yet.

A PowerShell export script is in `scripts/backup-playora-supabase.ps1`. It writes roles, schema and data dumps to a private folder outside the Git repository. It explicitly selects `auth,public` so Auth accounts are part of the logical export. The current Storage API inventory is empty; re-check it at backup time.

Run the script from the repository root after signing in and linking the project:

```powershell
supabase login
supabase link --project-ref nnowvfewtrfurnluhflt
.\scripts\backup-playora-supabase.ps1
```

Enter the database password only in the CLI prompt. Do not paste it into ChatGPT, a GitHub file, or a shell command. The current CLI uses the explicit `--remote=<project-ref>` target syntax; update the CLI if an older version rejects it.


The database dump is sensitive: keep it out of GitHub, email, and public cloud folders. Store it on encrypted local/off-site storage, verify SHA-256 hashes, and perform a restore test in a separate throwaway project before changing the live database. This backup is not yet created by this audit.

References:
- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI db dump](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Supabase Backup/Restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

## 5. Planned history normalization — not executed

Run these only from a clean local checkout of this branch, after the backup export succeeds and the full migration list has been checked. The CLI version must support the current `--remote=<project-ref>` target flag and `--yes` hosted-mutation confirmation.

### Step A — mark the 19 repository timestamps as already applied

```powershell
supabase migration repair --remote=nnowvfewtrfurnluhflt --status applied 20261020000000 20261020010000 20261020020000 20261020030000 20261020040000 20261021000000 20261022000000 20261023000000 20261023000100 20261023000200 20261024000000 20261025000000 20261026000000 20261027000000 20261031000000 20261031000100 20261031000200 20261031000300 20261031000400 --yes
```

### Step B — remove the 22 generated remote-history versions

```powershell
supabase migration repair --remote=nnowvfewtrfurnluhflt --status reverted 20261021221235 20261021221238 20261021221241 20261021221244 20261021221246 20261021221609 20261021222935 20261021223140 20261021223334 20261021224238 20261021224609 20261021224739 20261021230440 20261022210510 20261030234819 20261030234821 20261030235027 20261031003308 20261031003317 20261031003726 20261031003752 20261031005556 --yes
```

**Do not execute Steps A/B until the backup is verified and an operator reviews this exact mapping.** These commands only normalize the migration-history table; they do not execute or reverse SQL. If the CLI list after repair does not show the first 19 local versions as applied and only the five November/finance files as pending, stop and re-audit.

### Step C — dry-run and deploy the five pending migrations

```powershell
supabase migration list --remote=nnowvfewtrfurnluhflt
supabase db push --remote=nnowvfewtrfurnluhflt --dry-run
```

Expected dry-run: exactly these five files, in timestamp order:

1. `20261031000500_private_finance_admin_control_plane.sql`
2. `20261031000600_financial_fk_indexes.sql`
3. `20261101000000_enforce_verified_deposit_withdrawal_minimum.sql`
4. `20261101000100_signup_device_ip_guard.sql`
5. `20261101000200_reject_anonymous_social_and_leaderboard_rpcs.sql`

Only after the dry-run matches exactly and the backup has been restore-tested should the operator run:

```powershell
supabase db push --remote=nnowvfewtrfurnluhflt --yes
```

Do not run `db reset --remote`, do not run `db push --include-all`, and do not manually insert/delete history rows with SQL.


### Replay verification added to CI

CI run [#1165](https://github.com/kamyarmohamadi/playora_app/actions/runs/41261845416) completed successfully on commit `e222253fc5b2a01f89b7208d11f7a67c78e8b822`:

- 16 app, unit, type, production-build and Playwright steps
- 52 PostgreSQL, RLS, financial, signup, admin and migration-replay steps
- 13 Edge Function checks
- 81 successful steps total; no failed steps

The PostgreSQL workflow now re-applies the three repeated-name migrations (plugin hardening, Free/Paid economy, and track seeding) after their first application. All three replay steps passed in the disposable CI database. Finance-admin and finance-index migrations also run before the November 1 migrations, matching their real timestamp order.

This is CI-only evidence. It does not create a live backup, alter the live migration ledger, or deploy any migration to Supabase.

## 6. After-migration verification gates

1. Re-run the read-only SQL diagnostics and both Supabase Advisors.
2. Verify the withdrawal function includes `verified_deposit_history_below_minimum`.
3. Verify finance admin tables and signup guard objects exist.
4. Configure the Before User Created Auth Hook to `pg-functions://postgres/public/hook_playora_before_user_created`; migration alone does not turn the hook on.
5. Keep `VITE_SIGNUP_DEVICE_GUARD_ENABLED=false` until email and OAuth signup are tested on the live project.
6. Verify that the owner is provisioned out-of-band, then test finance-admin RPCs with real JWTs.
7. Keep all games disabled and all payment networks unconfigured until reviewed plugin artifacts and real payment details are ready.

## 7. Release status

This remains a preparation checkpoint. No live migrations, Auth hooks, payment networks, Edge Functions, or game plugins have been deployed or enabled by this report.

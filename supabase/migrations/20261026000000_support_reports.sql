-- Member-owned support intake. Tickets remain distinct; grouping is an admin-side future feature.
-- Public clients can create a report and read only their own reports; workflow fields remain server-owned.
begin;

create table public.support_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  category text not null
    check (category in ('bug','account','catalog','accessibility','other')),
  title text not null
    check (char_length(btrim(title)) between 5 and 120),
  description text not null
    check (char_length(btrim(description)) between 20 and 4000),
  app_version text not null
    check (char_length(btrim(app_version)) between 1 and 40),
  locale text not null check (locale in ('en','fa')),
  route_key text not null
    check (route_key in ('home','games','online','tournaments','friends','rooms','leaderboard','wallet','profile','settings')),
  diagnostics jsonb not null,
  status text not null default 'open'
    check (status in ('open','triaged','in_progress','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  constraint support_reports_diagnostics_safe_shape check (
    jsonb_typeof(diagnostics) = 'object'
    and diagnostics - array['appVersion','locale','route','browserFamily','osFamily']::text[] = '{}'::jsonb
    and jsonb_typeof(diagnostics->'appVersion') = 'string'
    and jsonb_typeof(diagnostics->'locale') = 'string'
    and jsonb_typeof(diagnostics->'route') = 'string'
    and jsonb_typeof(diagnostics->'browserFamily') = 'string'
    and jsonb_typeof(diagnostics->'osFamily') = 'string'
    and char_length(diagnostics->>'appVersion') between 1 and 40
    and diagnostics->>'appVersion' = app_version
    and diagnostics->>'locale' = locale
    and diagnostics->>'route' = route_key
    and char_length(diagnostics->>'browserFamily') between 1 and 24
    and char_length(diagnostics->>'osFamily') between 1 and 24
    and pg_column_size(diagnostics) <= 2048
  )
);

create index support_reports_member_recent_idx
  on public.support_reports(user_id, created_at desc);

create or replace function public.enforce_support_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $support_rate_limit$
declare
  v_recent_count integer;
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'support_report_member_mismatch'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  select count(*) into v_recent_count
  from public.support_reports report
  where report.user_id = new.user_id
    and report.created_at >= pg_catalog.now() - interval '1 hour';

  if v_recent_count >= 5 then
    raise exception 'support_report_rate_limited'
      using errcode = 'P0001';
  end if;

  return new;
end;
$support_rate_limit$;

revoke all on function public.enforce_support_report_rate_limit() from public, anon, authenticated, service_role;

create trigger support_reports_enforce_rate_limit
  before insert on public.support_reports
  for each row execute function public.enforce_support_report_rate_limit();

create trigger support_reports_set_updated_at
  before update on public.support_reports
  for each row execute function public.set_updated_at();

alter table public.support_reports enable row level security;

revoke all on table public.support_reports from public, anon, authenticated, service_role;
grant select (
  id, user_id, category, title, description, app_version, locale, route_key,
  diagnostics, status, created_at, updated_at
) on public.support_reports to authenticated;
grant insert (
  idempotency_key, category, title, description, app_version, locale, route_key, diagnostics
) on public.support_reports to authenticated;
grant select, insert, update on public.support_reports to service_role;

create policy "members read only their own support reports"
  on public.support_reports
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "members submit support reports for themselves"
  on public.support_reports
  for insert to authenticated
  with check (user_id = (select auth.uid()));

comment on table public.support_reports is
  'Member-owned support intake. Individual tickets are retained separately; triage/grouping is a future privileged workflow.';

commit;

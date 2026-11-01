-- Private finance administration identities and immutable operator audit trail.
begin;

create table if not exists public.platform_admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','finance_admin','support_admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create index if not exists platform_admin_members_active_role_idx
  on public.platform_admin_members(role,is_active);

alter table public.platform_admin_members enable row level security;
revoke all on public.platform_admin_members from public,anon,authenticated;
grant select,insert,update,delete on public.platform_admin_members to service_role;

create table if not exists public.platform_admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('owner','finance_admin','support_admin')),
  action text not null check (action ~ '^[a-z][a-z0-9_-]{2,63}$'),
  target_type text not null check (target_type ~ '^[a-z][a-z0-9_-]{2,63}$'),
  target_id text,
  outcome text not null check (outcome in ('success','failure')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_admin_audit_events_created_idx
  on public.platform_admin_audit_events(created_at desc);
create index if not exists platform_admin_audit_events_actor_idx
  on public.platform_admin_audit_events(actor_user_id,created_at desc);

alter table public.platform_admin_audit_events enable row level security;
revoke all on public.platform_admin_audit_events from public,anon,authenticated;
grant select,insert on public.platform_admin_audit_events to service_role;

comment on table public.platform_admin_members is
  'Privileged finance/support operators. Membership is provisioned out-of-band by the project owner; never client-editable.';
comment on table public.platform_admin_audit_events is
  'Append-only audit trail for privileged finance configuration and manual review actions.';

commit;

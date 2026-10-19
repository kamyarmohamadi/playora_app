-- Social relationships and authenticated leaderboard APIs.
-- Client roles can only read relationship rows through the user's RLS policy.
-- Inserts/updates and leaderboard projection are handled by narrow server-side RPCs.

create table if not exists public.social_action_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('send_friend_request','respond_friend_request')),
  created_at timestamptz not null default now()
);
create index if not exists social_action_events_member_recent_idx
  on public.social_action_events(user_id,event_type,created_at desc);
alter table public.social_action_events enable row level security;
revoke all on table public.social_action_events from public, anon, authenticated;

create index if not exists member_profiles_username_lower_idx
  on public.member_profiles(lower(username));

create or replace function public.list_social_relationships()
returns table(
  request_id uuid,
  other_username text,
  other_display_name text,
  relationship_type text,
  request_status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if coalesce(auth.role(),'') <> 'authenticated' or v_user_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  select
    fr.id,
    peer.username,
    peer.display_name,
    case
      when fr.status='accepted' then 'friend'
      when fr.status='pending' and fr.recipient_id=v_user_id then 'incoming'
      when fr.status='pending' and fr.sender_id=v_user_id then 'outgoing'
      when fr.status='blocked' and fr.recipient_id=v_user_id then 'blocked'
      else 'hidden'
    end::text,
    fr.status::text,
    fr.created_at
  from public.friend_requests fr
  join public.member_profiles peer
    on peer.user_id = case when fr.sender_id=v_user_id then fr.recipient_id else fr.sender_id end
  where (fr.sender_id=v_user_id or fr.recipient_id=v_user_id)
    and (fr.status <> 'blocked' or fr.recipient_id=v_user_id)
  order by
    case
      when fr.status='pending' and fr.recipient_id=v_user_id then 0
      when fr.status='pending' and fr.sender_id=v_user_id then 1
      when fr.status='accepted' then 2
      else 3
    end,
    fr.created_at desc;
end;
$$;
revoke all on function public.list_social_relationships() from public, anon;
grant execute on function public.list_social_relationships() to authenticated;

create or replace function public.send_friend_request(p_username text)
returns table(request_id uuid, relationship_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_target_id uuid;
  v_request_id uuid;
  v_status text;
  v_recent_minute integer;
  v_recent_hour integer;
begin
  if coalesce(auth.role(),'') <> 'authenticated' or v_user_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_username is null or pg_catalog.char_length(pg_catalog.trim(p_username)) not between 3 and 24
     or pg_catalog.trim(p_username) !~ '^[a-zA-Z0-9_]{3,24}$' then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 17));

  select count(*)::integer into v_recent_minute
  from public.social_action_events e
  where e.user_id=v_user_id and e.event_type='send_friend_request'
    and e.created_at > now()-interval '1 minute';
  if v_recent_minute >= 5 then
    raise exception 'friend_request_rate_limited' using errcode = '22023';
  end if;

  select count(*)::integer into v_recent_hour
  from public.social_action_events e
  where e.user_id=v_user_id and e.event_type='send_friend_request'
    and e.created_at > now()-interval '1 hour';
  if v_recent_hour >= 25 then
    raise exception 'friend_request_rate_limited' using errcode = '22023';
  end if;

  insert into public.social_action_events(user_id,event_type)
  values(v_user_id,'send_friend_request');

  select p.user_id into v_target_id
  from public.member_profiles p
  where pg_catalog.lower(p.username)=pg_catalog.lower(pg_catalog.trim(p_username))
    and p.user_id <> v_user_id
  limit 1;

  -- Do not reveal whether an arbitrary username exists to callers.
  if v_target_id is null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.friend_requests fr
    where fr.status='blocked'
      and ((fr.sender_id=v_user_id and fr.recipient_id=v_target_id)
        or (fr.sender_id=v_target_id and fr.recipient_id=v_user_id))
  ) then
    raise exception 'relationship_not_available' using errcode = 'P0002';
  end if;

  select fr.id,fr.status into v_request_id,v_status
  from public.friend_requests fr
  where fr.status='accepted'
    and ((fr.sender_id=v_user_id and fr.recipient_id=v_target_id)
      or (fr.sender_id=v_target_id and fr.recipient_id=v_user_id))
  limit 1;
  if found then
    return query select v_request_id,'accepted'::text;
    return;
  end if;

  -- If the target has already sent a pending request, expose that request as incoming.
  select fr.id into v_request_id
  from public.friend_requests fr
  where fr.sender_id=v_target_id and fr.recipient_id=v_user_id and fr.status='pending'
  limit 1;
  if found then
    return query select v_request_id,'incoming'::text;
    return;
  end if;

  select fr.id,fr.status into v_request_id,v_status
  from public.friend_requests fr
  where fr.sender_id=v_user_id and fr.recipient_id=v_target_id
  limit 1;

  if found and v_status='pending' then
    return query select v_request_id,'pending'::text;
    return;
  elsif found and v_status='blocked' then
    raise exception 'relationship_not_available' using errcode = 'P0002';
  elsif found and v_status='declined' then
    update public.friend_requests
    set status='pending',created_at=now(),responded_at=null
    where id=v_request_id
    returning id into v_request_id;
    return query select v_request_id,'pending'::text;
    return;
  end if;

  insert into public.friend_requests(sender_id,recipient_id,status)
  values(v_user_id,v_target_id,'pending')
  on conflict(sender_id,recipient_id) do nothing
  returning id into v_request_id;

  if v_request_id is null then
    select fr.id,fr.status into v_request_id,v_status
    from public.friend_requests fr
    where fr.sender_id=v_user_id and fr.recipient_id=v_target_id;
    if v_status='blocked' then
      raise exception 'relationship_not_available' using errcode = 'P0002';
    end if;
    return query select v_request_id,coalesce(v_status,'pending')::text;
    return;
  end if;

  return query select v_request_id,'pending'::text;
end;
$$;
revoke all on function public.send_friend_request(text) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;

create or replace function public.respond_friend_request(p_request_id uuid,p_action text)
returns table(request_id uuid, relationship_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_updated_id uuid;
begin
  if coalesce(auth.role(),'') <> 'authenticated' or v_user_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_action not in ('accepted','declined','blocked') then
    raise exception 'invalid_relationship_action' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 29));

  if (select count(*) from public.social_action_events e
      where e.user_id=v_user_id and e.event_type='respond_friend_request'
        and e.created_at > now()-interval '1 minute') >= 20 then
    raise exception 'relationship_rate_limited' using errcode = '22023';
  end if;
  insert into public.social_action_events(user_id,event_type)
  values(v_user_id,'respond_friend_request');

  update public.friend_requests fr
  set status=p_action,responded_at=now()
  where fr.id=p_request_id and fr.recipient_id=v_user_id and fr.status='pending'
  returning fr.id,fr.status into v_updated_id,v_status;

  if v_updated_id is null then
    raise exception 'request_not_available' using errcode = 'P0002';
  end if;

  return query select v_updated_id,v_status;
end;
$$;
revoke all on function public.respond_friend_request(uuid,text) from public, anon;
grant execute on function public.respond_friend_request(uuid,text) to authenticated;

create or replace function public.get_game_leaderboard(
  p_game_id text default 'tictactoe',
  p_limit integer default 25
)
returns table(
  rank_position bigint,
  username text,
  display_name text,
  xp bigint,
  competitive_rating integer,
  matches_played integer,
  wins integer,
  losses integer,
  draws integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit,25),1),100);
begin
  if coalesce(auth.role(),'') <> 'authenticated' or v_user_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_game_id is null or not exists (
    select 1 from public.catalog_games g where g.id=p_game_id and g.is_enabled=true
  ) then
    raise exception 'game_not_available' using errcode = '22023';
  end if;

  return query
  select
    pg_catalog.row_number() over (
      order by s.competitive_rating desc,s.xp desc,s.wins desc,s.updated_at asc,s.user_id
    )::bigint,
    p.username,
    p.display_name,
    s.xp,
    s.competitive_rating,
    s.matches_played,
    s.wins,
    s.losses,
    s.draws,
    s.updated_at
  from public.member_game_stats s
  join public.member_profiles p on p.user_id=s.user_id
  where s.game_id=p_game_id and s.matches_played > 0
  order by s.competitive_rating desc,s.xp desc,s.wins desc,s.updated_at asc,s.user_id
  limit v_limit;
end;
$$;
revoke all on function public.get_game_leaderboard(text,integer) from public, anon;
grant execute on function public.get_game_leaderboard(text,integer) to authenticated;

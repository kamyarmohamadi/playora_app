-- Prepare a member's sessions for self-service account deletion.
-- The admin identity deletion itself is performed by a trusted Edge Function.

create or replace function public.prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'invalid_member' using errcode = '22023';
  end if;

  -- Cancel pending matchmaking before the auth row is deleted.
  update public.matchmaking_queue
  set status='cancelled', updated_at=now()
  where user_id=p_user_id and status='waiting';

  -- Cancel unfinished matches involving the member. No XP, rating, wins,
  -- losses, or coin changes are issued for an abandoned/deleted account.
  with cancelled_matches as (
    update public.matches m
    set status='cancelled',
        winner_user_id=null,
        finished_at=coalesce(finished_at,now()),
        state_version=state_version+1
    where m.status in ('created','waiting','active')
      and exists (
        select 1 from public.match_participants p
        where p.match_id=m.id and p.user_id=p_user_id
      )
    returning m.id
  )
  update public.match_participants p
  set final_result=null
  from cancelled_matches c
  where p.match_id=c.id;

  -- Close any rooms the member hosts or occupies. Host-owned rooms will
  -- cascade on auth-user deletion; occupied rooms hosted by others stay closed.
  update public.private_rooms r
  set status='closed'
  where r.status in ('open','active')
    and (
      r.host_user_id=p_user_id
      or exists (
        select 1 from public.room_members rm
        where rm.room_id=r.id and rm.user_id=p_user_id
      )
    );
end;
$$;

revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated, service_role;
grant execute on function public.prepare_account_deletion(uuid) to service_role;

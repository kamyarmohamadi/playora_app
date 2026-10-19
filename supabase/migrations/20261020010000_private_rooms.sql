-- Private Tic Tac Toe rooms: free entry, server-authoritative state, zero XP/rating/coin impact.
-- Apply after 20261020000000_secure_member_data.sql.

alter table public.private_rooms
  add column if not exists match_id uuid references public.matches(id) on delete set null;
create unique index if not exists private_rooms_match_unique
  on public.private_rooms(match_id) where match_id is not null;

-- Resolve pgcrypto's installed schema at runtime. On Supabase, extensions are
-- commonly installed in the "extensions" schema; local PostgreSQL may use public.
create or replace function public.hash_room_invite_code(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_crypto_schema text;
  v_hash text;
begin
  if p_code is null or pg_catalog.char_length(p_code) < 16 or pg_catalog.char_length(p_code) > 128 then
    raise exception 'invalid_invite_code' using errcode = '22023';
  end if;

  select n.nspname into v_crypto_schema
  from pg_catalog.pg_extension e
  join pg_catalog.pg_namespace n on n.oid=e.extnamespace
  where e.extname='pgcrypto';

  if v_crypto_schema is null then
    raise exception 'crypto_extension_unavailable' using errcode = '55000';
  end if;

  execute pg_catalog.format('select pg_catalog.encode(%I.digest($1, $2), $3)',v_crypto_schema)
  into v_hash
  using p_code,'sha256','hex';

  return v_hash;
end;
$$;
revoke all on function public.hash_room_invite_code(text) from public, anon, authenticated;

create or replace function public.create_private_room(
  p_game_id text,
  p_max_players integer default 2
)
returns table(created_room_id uuid, invite_code text, room_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_code text;
  v_expires timestamptz;
  v_hash text;
  v_open_rooms integer;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_game_id is distinct from 'tictactoe' or p_max_players is distinct from 2 then
    raise exception 'game_not_supported_for_private_rooms' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.catalog_games g where g.id=p_game_id and g.is_enabled=true
  ) then
    raise exception 'game_not_available' using errcode = '22023';
  end if;

  -- Serialize per-host room creation so concurrent requests cannot bypass
  -- the maximum of three open rooms.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('playora-private-room:' || v_user_id::text, 0)
  );

  select count(*) into v_open_rooms
  from public.private_rooms r
  where r.host_user_id=v_user_id and r.status='open' and r.expires_at > now();
  if v_open_rooms >= 3 then
    raise exception 'too_many_open_rooms' using errcode = '22023';
  end if;

  -- A fresh 128-bit random invite code; only its SHA-256 hash is persisted.
  v_code := pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-','');
  v_hash := public.hash_room_invite_code(v_code);

  insert into public.private_rooms(host_user_id,game_id,status,max_players,expires_at)
  values(v_user_id,p_game_id,'open',p_max_players,now()+interval '24 hours')
  returning id,expires_at into v_room_id,v_expires;

  insert into public.private_room_secrets(room_id,invite_code_hash)
  values(v_room_id,v_hash);
  insert into public.room_members(room_id,user_id,role)
  values(v_room_id,v_user_id,'host');

  return query select v_room_id,v_code,v_expires;
end;
$$;
revoke all on function public.create_private_room(text,integer) from public, anon;
grant execute on function public.create_private_room(text,integer) to authenticated;

create or replace function public.join_private_room(p_invite_code text)
returns table(joined_room_id uuid, joined_game_id text, room_status text, active_match_id uuid, room_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.private_rooms%rowtype;
  v_member_count integer;
  v_match_id uuid;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_invite_code is null or p_invite_code !~ '^[0-9a-fA-F]{32}$' then
    raise exception 'room_not_available' using errcode = '22023';
  end if;

  select r.* into v_room
  from public.private_room_secrets s
  join public.private_rooms r on r.id=s.room_id
  where s.invite_code_hash=public.hash_room_invite_code(pg_catalog.lower(pg_catalog.btrim(p_invite_code)))
  for update of r;

  if not found then
    raise exception 'room_not_available' using errcode = 'P0002';
  end if;

  -- Existing members can safely refresh room state without being counted twice.
  if exists (
    select 1 from public.room_members rm
    where rm.room_id=v_room.id and rm.user_id=v_user_id
  ) then
    return query select v_room.id,v_room.game_id,v_room.status,v_room.match_id,v_room.expires_at;
    return;
  end if;

  if v_room.status <> 'open' or v_room.expires_at <= now() then
    raise exception 'room_not_available' using errcode = 'P0002';
  end if;

  select count(*) into v_member_count
  from public.room_members rm where rm.room_id=v_room.id;
  if v_member_count >= v_room.max_players then
    raise exception 'room_not_available' using errcode = 'P0002';
  end if;

  insert into public.room_members(room_id,user_id,role)
  values(v_room.id,v_user_id,'player')
  on conflict (room_id,user_id) do nothing;

  select count(*) into v_member_count
  from public.room_members rm where rm.room_id=v_room.id;

  if v_member_count = v_room.max_players then
    insert into public.matches(game_id,mode,status,state_version,server_state,started_at)
    values(
      'tictactoe','private','active',0,
      pg_catalog.jsonb_build_object(
        'board',pg_catalog.jsonb_build_array(null,null,null,null,null,null,null,null,null),
        'current_mark','X',
        'current_seat',1
      ),
      now()
    )
    returning id into v_match_id;

    insert into public.match_participants(match_id,user_id,seat)
    select v_match_id,rm.user_id,row_number() over(order by rm.joined_at,rm.user_id)::smallint
    from public.room_members rm
    where rm.room_id=v_room.id
    order by rm.joined_at,rm.user_id;

    update public.private_rooms
    set status='active',match_id=v_match_id
    where id=v_room.id;

    v_room.status := 'active';
    v_room.match_id := v_match_id;
  end if;

  return query select v_room.id,v_room.game_id,v_room.status,v_room.match_id,v_room.expires_at;
end;
$$;
revoke all on function public.join_private_room(text) from public, anon;
grant execute on function public.join_private_room(text) to authenticated;

create or replace function public.leave_private_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.private_rooms%rowtype;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v_room from public.private_rooms r where r.id=p_room_id for update;
  if not found or not exists (
    select 1 from public.room_members rm where rm.room_id=p_room_id and rm.user_id=v_user_id
  ) then
    raise exception 'room_not_available' using errcode = 'P0002';
  end if;
  if v_room.status in ('active') then
    raise exception 'room_in_progress' using errcode = '22023';
  end if;
  if v_room.status in ('closed','expired') then
    return false;
  end if;
  if v_room.host_user_id=v_user_id then
    update public.private_rooms set status='closed' where id=p_room_id and status='open';
    delete from public.room_members where room_id=p_room_id;
    return true;
  end if;
  delete from public.room_members where room_id=p_room_id and user_id=v_user_id;
  return found;
end;
$$;
revoke all on function public.leave_private_room(uuid) from public, anon;
grant execute on function public.leave_private_room(uuid) to authenticated;

create or replace function public.submit_private_tictactoe_move(p_match_id uuid,p_cell_index integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_seat integer;
  v_match public.matches%rowtype;
  v_board jsonb;
  v_state jsonb;
  v_mark text;
  v_winner_mark text;
  v_winner_user uuid;
  v_loser_user uuid;
  v_draw boolean;
  v_next_seat integer;
  v_next_mark text;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_cell_index is null or p_cell_index < 0 or p_cell_index > 8 then
    raise exception 'invalid_cell' using errcode = '22023';
  end if;

  select m.* into v_match
  from public.matches m
  where m.id=p_match_id and m.game_id='tictactoe' and m.mode='private'
  for update;
  if not found or v_match.status <> 'active'
     or not exists (
       select 1 from public.match_participants p
       where p.match_id=p_match_id and p.user_id=v_user_id
     )
     or not exists (
       select 1 from public.private_rooms r
       where r.match_id=p_match_id and r.status='active'
     )
  then
    raise exception 'match_not_available' using errcode = '42501';
  end if;

  select p.seat into v_user_seat
  from public.match_participants p where p.match_id=p_match_id and p.user_id=v_user_id;
  if (v_match.server_state->>'current_seat')::integer <> v_user_seat then
    raise exception 'not_your_turn' using errcode = '42501';
  end if;

  v_board := v_match.server_state->'board';
  if pg_catalog.jsonb_typeof(v_board) <> 'array' or pg_catalog.jsonb_array_length(v_board) <> 9 then
    raise exception 'invalid_match_state' using errcode = '22023';
  end if;
  if (v_board -> p_cell_index) is distinct from 'null'::jsonb then
    raise exception 'cell_occupied' using errcode = '22023';
  end if;

  v_mark := v_match.server_state->>'current_mark';
  if v_mark not in ('X','O') then
    raise exception 'invalid_match_state' using errcode = '22023';
  end if;
  v_board := pg_catalog.jsonb_set(v_board,array[p_cell_index::text],pg_catalog.to_jsonb(v_mark),false);
  v_state := pg_catalog.jsonb_set(v_match.server_state,'{board}',v_board,false);
  v_winner_mark := public.find_tictactoe_winner(v_board);
  v_draw := v_winner_mark is null and not exists (
    select 1 from pg_catalog.jsonb_array_elements(v_board) as cells(value)
    where cells.value='null'::jsonb
  );

  if v_winner_mark is not null then
    select p.user_id into v_winner_user
    from public.match_participants p
    where p.match_id=p_match_id and p.seat=case when v_winner_mark='X' then 1 else 2 end;
    v_loser_user := (select p.user_id from public.match_participants p
      where p.match_id=p_match_id and p.seat=case when v_winner_mark='X' then 2 else 1 end);

    update public.matches
    set status='completed',winner_user_id=v_winner_user,server_state=v_state,
        state_version=state_version+1,finished_at=now()
    where id=p_match_id returning * into v_match;

    update public.match_participants
    set final_result=case when user_id=v_winner_user then 'win' else 'loss' end
    where match_id=p_match_id;
    update public.private_rooms set status='closed' where match_id=p_match_id;

    return pg_catalog.jsonb_build_object(
      'match_id',v_match.id,'status',v_match.status,'state',v_match.server_state,
      'state_version',v_match.state_version,'winner_mark',v_winner_mark,'rewarded',false
    );
  elsif v_draw then
    update public.matches
    set status='completed',winner_user_id=null,server_state=v_state,
        state_version=state_version+1,finished_at=now()
    where id=p_match_id returning * into v_match;
    update public.match_participants set final_result='draw' where match_id=p_match_id;
    update public.private_rooms set status='closed' where match_id=p_match_id;

    return pg_catalog.jsonb_build_object(
      'match_id',v_match.id,'status',v_match.status,'state',v_match.server_state,
      'state_version',v_match.state_version,'winner_mark',null,'rewarded',false
    );
  end if;

  v_next_seat := case when v_user_seat=1 then 2 else 1 end;
  v_next_mark := case when v_mark='X' then 'O' else 'X' end;
  v_state := pg_catalog.jsonb_set(v_state,'{current_mark}',pg_catalog.to_jsonb(v_next_mark),false);
  v_state := pg_catalog.jsonb_set(v_state,'{current_seat}',pg_catalog.to_jsonb(v_next_seat),false);

  update public.matches
  set server_state=v_state,state_version=state_version+1
  where id=p_match_id and status='active'
  returning * into v_match;

  return pg_catalog.jsonb_build_object(
    'match_id',v_match.id,'status',v_match.status,'state',v_match.server_state,
    'state_version',v_match.state_version,'winner_mark',null,'rewarded',false
  );
end;
$$;
revoke all on function public.submit_private_tictactoe_move(uuid,integer) from public, anon;
grant execute on function public.submit_private_tictactoe_move(uuid,integer) to authenticated;

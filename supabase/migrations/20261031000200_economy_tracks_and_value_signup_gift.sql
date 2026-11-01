-- Independent Free/Paid progression tracks and value-wallet signup grant.
-- Existing historical match statistics remain in the Free track; no XP/rating is blended.
begin;

alter table public.matches add column if not exists economy_mode text not null default 'free';
alter table public.matchmaking_queue add column if not exists economy_mode text not null default 'free';
alter table public.member_game_stats add column if not exists economy_mode text not null default 'free';
alter table public.private_rooms add column if not exists economy_mode text not null default 'free';

do $constraints$
begin
  if not exists(select 1 from pg_constraint where conname='matches_economy_mode_check') then
    alter table public.matches add constraint matches_economy_mode_check check (economy_mode in ('free','paid'));
  end if;
  if not exists(select 1 from pg_constraint where conname='matchmaking_queue_economy_mode_check') then
    alter table public.matchmaking_queue add constraint matchmaking_queue_economy_mode_check check (economy_mode in ('free','paid'));
  end if;
  if not exists(select 1 from pg_constraint where conname='member_game_stats_economy_mode_check') then
    alter table public.member_game_stats add constraint member_game_stats_economy_mode_check check (economy_mode in ('free','paid'));
  end if;
  if not exists(select 1 from pg_constraint where conname='private_rooms_economy_mode_check') then
    alter table public.private_rooms add constraint private_rooms_economy_mode_check check (economy_mode in ('free','paid'));
  end if;
end
$constraints$;

alter table public.member_game_stats drop constraint if exists member_game_stats_pkey;
alter table public.member_game_stats add constraint member_game_stats_pkey primary key(user_id,game_id,economy_mode);
drop index if exists public.member_game_stats_leaderboard_idx;
create index if not exists member_game_stats_leaderboard_mode_idx
  on public.member_game_stats(game_id,economy_mode,competitive_rating desc,xp desc,wins desc);
create index if not exists member_game_stats_member_mode_idx
  on public.member_game_stats(user_id,economy_mode,game_id);

drop index if exists public.matchmaking_one_waiting_per_member_game;
create unique index if not exists matchmaking_one_waiting_per_member_game_mode
  on public.matchmaking_queue(user_id,game_id,economy_mode) where status='waiting';
drop index if exists public.matchmaking_candidates_idx;
create index if not exists matchmaking_candidates_mode_idx
  on public.matchmaking_queue(game_id,economy_mode,status,created_at) where status='waiting';

-- A match's economy classification is immutable once created.
create or replace function public.guard_match_economy_mode()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.economy_mode is distinct from old.economy_mode then
    raise exception 'match_economy_mode_is_immutable' using errcode='22023';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_match_economy_mode() from public,anon,authenticated;
drop trigger if exists matches_economy_mode_immutable on public.matches;
create trigger matches_economy_mode_immutable
before update of economy_mode on public.matches
for each row execute function public.guard_match_economy_mode();

-- The previously available matchmaking path is explicitly the Free track.
create or replace function public.queue_for_random_match(p_game_id text)
returns table(queue_status text, matched_match_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_rating integer;
  v_queue public.matchmaking_queue;
  v_opponent public.matchmaking_queue;
  v_match_id uuid;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_game_id is distinct from 'tictactoe' then
    raise exception 'game_not_supported_for_online_matchmaking' using errcode = '22023';
  end if;
  if not exists (select 1 from public.catalog_games g where g.id = p_game_id and g.is_enabled = true) then
    raise exception 'game_not_available' using errcode = '22023';
  end if;

  -- Serialize queue operations per game; the queue is small at launch and this
  -- makes duplicate concurrent joins unable to match a player twice.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('playora-queue:' || p_game_id, 0));

  insert into public.member_game_stats(user_id,game_id,economy_mode)
  values(v_user_id,p_game_id,'free')
  on conflict (user_id,game_id,economy_mode) do nothing;

  select s.competitive_rating into v_rating
  from public.member_game_stats s
  where s.user_id = v_user_id and s.game_id = p_game_id and s.economy_mode = 'free';

  -- If the member already has an active match, return it instead of opening a second one.
  select q.match_id into v_match_id
  from public.matchmaking_queue q
  join public.matches m on m.id = q.match_id and m.status = 'active' and m.economy_mode = 'free'
  where q.user_id = v_user_id and q.game_id = p_game_id and q.economy_mode = 'free' and q.status = 'matched'
  order by q.updated_at desc
  limit 1;
  if found then
    return query select 'matched'::text, v_match_id;
    return;
  end if;

  select q.* into v_queue
  from public.matchmaking_queue q
  where q.user_id = v_user_id and q.game_id = p_game_id and q.economy_mode = 'free' and q.status = 'waiting'
  order by q.created_at desc
  limit 1
  for update;

  if not found then
    insert into public.matchmaking_queue(user_id,game_id,economy_mode,status,rating_snapshot)
    values(v_user_id,p_game_id,'free','waiting',v_rating)
    on conflict (user_id,game_id,economy_mode) where status = 'waiting' do nothing
    returning * into v_queue;

    if not found then
      select q.* into v_queue
      from public.matchmaking_queue q
      where q.user_id = v_user_id and q.game_id = p_game_id and q.economy_mode = 'free' and q.status = 'waiting'
      order by q.created_at desc limit 1 for update;
    end if;
  end if;

  select q.* into v_opponent
  from public.matchmaking_queue q
  where q.game_id = p_game_id
    and q.economy_mode = 'free'
    and q.status = 'waiting'
    and q.user_id <> v_user_id
    and pg_catalog.abs(q.rating_snapshot - v_queue.rating_snapshot) <= 200
    and not exists (
      select 1
      from public.matches old_match
      join public.match_participants self_participant on self_participant.match_id = old_match.id and self_participant.user_id = v_user_id
      join public.match_participants opponent_participant on opponent_participant.match_id = old_match.id and opponent_participant.user_id = q.user_id
      where old_match.game_id = p_game_id
        and old_match.economy_mode = 'free'
        and old_match.status = 'completed'
        and old_match.created_at >= now() - interval '24 hours'
    )
  order by random()
  limit 1
  for update skip locked;

  if not found then
    return query select 'waiting'::text, null::uuid;
    return;
  end if;

  insert into public.member_game_stats(user_id,game_id,economy_mode)
  values(v_opponent.user_id,p_game_id,'free')
  on conflict (user_id,game_id,economy_mode) do nothing;

  insert into public.matches(game_id,mode,economy_mode,status,state_version,server_state,started_at)
  values (
    p_game_id,
    'ranked',
    'free',
    'active',
    0,
    pg_catalog.jsonb_build_object(
      'board', pg_catalog.jsonb_build_array(null,null,null,null,null,null,null,null,null),
      'current_mark', 'X',
      'current_seat', 1
    ),
    now()
  )
  returning id into v_match_id;

  -- The previously queued member is seat 1 / X. The current member is seat 2 / O.
  insert into public.match_participants(match_id,user_id,seat)
  values (v_match_id,v_opponent.user_id,1),(v_match_id,v_user_id,2);

  update public.matchmaking_queue
  set status = 'matched', match_id = v_match_id, updated_at = now()
  where id in (v_queue.id,v_opponent.id);

  return query select 'matched'::text, v_match_id;
end;
$$;
revoke all on function public.queue_for_random_match(text) from public, anon;
grant execute on function public.queue_for_random_match(text) to authenticated;


revoke all on function public.queue_for_random_match(text) from public,anon,authenticated;

-- Apply verified outcomes only to the track attached to the immutable match row.
create or replace function public.submit_tictactoe_move(p_match_id uuid, p_cell_index integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_seat integer;
  v_match public.matches;
  v_board jsonb;
  v_new_state jsonb;
  v_mark text;
  v_winner_mark text;
  v_draw boolean;
  v_winner_user uuid;
  v_loser_user uuid;
  v_seat_one_user uuid;
  v_seat_two_user uuid;
  v_winner_rating integer;
  v_loser_rating integer;
  v_seat_one_rating integer;
  v_seat_two_rating integer;
  v_rating_delta integer;
  v_expected numeric;
  v_expected_seat_one numeric;
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
  where m.id = p_match_id and m.game_id = 'tictactoe'
  for update;
  if not found
     or v_match.status <> 'active'
     or v_match.mode <> 'ranked'
     or not exists (
       select 1 from public.match_participants p
       where p.match_id = p_match_id and p.user_id = v_user_id
     )
  then
    raise exception 'match_not_available' using errcode = '42501';
  end if;

  select p.seat into v_user_seat
  from public.match_participants p
  where p.match_id = p_match_id and p.user_id = v_user_id;
  if v_user_seat is null then
    raise exception 'not_a_match_participant' using errcode = '42501';
  end if;
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

  v_board := pg_catalog.jsonb_set(v_board, array[p_cell_index::text], pg_catalog.to_jsonb(v_mark), false);
  v_new_state := pg_catalog.jsonb_set(v_match.server_state, '{board}', v_board, false);
  v_winner_mark := public.find_tictactoe_winner(v_board);
  v_draw := v_winner_mark is null and not exists (
    select 1 from pg_catalog.jsonb_array_elements(v_board) as cells(value)
    where cells.value = 'null'::jsonb
  );

  if v_winner_mark is not null then
    select p.user_id into v_seat_one_user from public.match_participants p where p.match_id=p_match_id and p.seat=1;
    select p.user_id into v_seat_two_user from public.match_participants p where p.match_id=p_match_id and p.seat=2;
    v_winner_user := case when v_winner_mark = 'X' then v_seat_one_user else v_seat_two_user end;
    v_loser_user := case when v_winner_mark = 'X' then v_seat_two_user else v_seat_one_user end;

    insert into public.member_game_stats(user_id,game_id,economy_mode) values(v_winner_user,'tictactoe',v_match.economy_mode),(v_loser_user,'tictactoe',v_match.economy_mode)
    on conflict (user_id,game_id,economy_mode) do nothing;
    select s.competitive_rating into v_winner_rating from public.member_game_stats s where s.user_id=v_winner_user and s.game_id='tictactoe' and s.economy_mode=v_match.economy_mode for update;
    select s.competitive_rating into v_loser_rating from public.member_game_stats s where s.user_id=v_loser_user and s.game_id='tictactoe' and s.economy_mode=v_match.economy_mode for update;

    v_expected := 1.0 / (1.0 + pg_catalog.power(10.0, (v_loser_rating::numeric - v_winner_rating::numeric) / 400.0));
    v_rating_delta := pg_catalog.round(32.0 * (1.0 - v_expected))::integer;

    update public.matches
    set status='completed', winner_user_id=v_winner_user, server_state=v_new_state,
        state_version=state_version+1, finished_at=now()
    where id=p_match_id returning * into v_match;
    update public.match_participants
    set final_result=case when user_id=v_winner_user then 'win' else 'loss' end
    where match_id=p_match_id;

    update public.member_game_stats
    set xp=xp + case when v_loser_rating > v_winner_rating then 25 when v_loser_rating = v_winner_rating then 20 else 15 end,
        competitive_rating=greatest(100,least(10000,competitive_rating+v_rating_delta)),
        matches_played=matches_played+1,wins=wins+1,updated_at=now()
    where user_id=v_winner_user and game_id='tictactoe' and economy_mode=v_match.economy_mode;

    update public.member_game_stats
    set xp=xp + case when v_loser_rating > v_winner_rating then 5 when v_loser_rating = v_winner_rating then 6 else 8 end,
        competitive_rating=greatest(100,least(10000,competitive_rating-v_rating_delta)),
        matches_played=matches_played+1,losses=losses+1,updated_at=now()
    where user_id=v_loser_user and game_id='tictactoe' and economy_mode=v_match.economy_mode;

    return pg_catalog.jsonb_build_object(
      'match_id',v_match.id,'status',v_match.status,'state',v_match.server_state,
      'state_version',v_match.state_version,'winner_mark',v_winner_mark
    );
  elsif v_draw then
    select p.user_id into v_seat_one_user from public.match_participants p where p.match_id=p_match_id and p.seat=1;
    select p.user_id into v_seat_two_user from public.match_participants p where p.match_id=p_match_id and p.seat=2;
    insert into public.member_game_stats(user_id,game_id,economy_mode) values(v_seat_one_user,'tictactoe',v_match.economy_mode),(v_seat_two_user,'tictactoe',v_match.economy_mode)
    on conflict (user_id,game_id,economy_mode) do nothing;
    select s.competitive_rating into v_seat_one_rating from public.member_game_stats s where s.user_id=v_seat_one_user and s.game_id='tictactoe' and s.economy_mode=v_match.economy_mode for update;
    select s.competitive_rating into v_seat_two_rating from public.member_game_stats s where s.user_id=v_seat_two_user and s.game_id='tictactoe' and s.economy_mode=v_match.economy_mode for update;
    v_expected_seat_one := 1.0 / (1.0 + pg_catalog.power(10.0, (v_seat_two_rating::numeric - v_seat_one_rating::numeric) / 400.0));
    v_rating_delta := pg_catalog.round(32.0 * (0.5 - v_expected_seat_one))::integer;

    update public.matches
    set status='completed', winner_user_id=null, server_state=v_new_state,
        state_version=state_version+1, finished_at=now()
    where id=p_match_id returning * into v_match;
    update public.match_participants set final_result='draw' where match_id=p_match_id;
    update public.member_game_stats
    set xp=xp+10,competitive_rating=greatest(100,least(10000,competitive_rating+v_rating_delta)),
        matches_played=matches_played+1,draws=draws+1,updated_at=now()
    where user_id=v_seat_one_user and game_id='tictactoe' and economy_mode=v_match.economy_mode;
    update public.member_game_stats
    set xp=xp+10,competitive_rating=greatest(100,least(10000,competitive_rating-v_rating_delta)),
        matches_played=matches_played+1,draws=draws+1,updated_at=now()
    where user_id=v_seat_two_user and game_id='tictactoe' and economy_mode=v_match.economy_mode;

    return pg_catalog.jsonb_build_object(
      'match_id',v_match.id,'status',v_match.status,'state',v_match.server_state,
      'state_version',v_match.state_version,'winner_mark',null
    );
  end if;

  v_next_seat := case when v_user_seat = 1 then 2 else 1 end;
  v_next_mark := case when v_mark = 'X' then 'O' else 'X' end;
  v_new_state := pg_catalog.jsonb_set(v_new_state, '{current_mark}', pg_catalog.to_jsonb(v_next_mark), false);
  v_new_state := pg_catalog.jsonb_set(v_new_state, '{current_seat}', pg_catalog.to_jsonb(v_next_seat), false);

  update public.matches
  set server_state=v_new_state,state_version=state_version+1
  where id=p_match_id and status='active'
  returning * into v_match;

  return pg_catalog.jsonb_build_object(
    'match_id',v_match.id,'status',v_match.status,'state',v_match.server_state,
    'state_version',v_match.state_version,'winner_mark',null
  );
end;
$$;

revoke all on function public.submit_tictactoe_move(uuid,integer) from public,anon,authenticated;

-- Existing leaderboard endpoint remains Free-only; the mode-aware endpoint is kept closed
-- until an approved game plugin and its economic settlement engine are released.
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
  where s.game_id=p_game_id and s.economy_mode='free' and s.matches_played > 0
  order by s.competitive_rating desc,s.xp desc,s.wins desc,s.updated_at asc,s.user_id
  limit v_limit;
end;
$$;

revoke all on function public.get_game_leaderboard(text,integer) from public,anon,authenticated;
create or replace function public.get_game_leaderboard_for_mode(
  p_game_id text,
  p_economy_mode text,
  p_limit integer default 25
)
returns table(rank_position bigint, username text, display_name text, xp bigint, competitive_rating integer, matches_played integer, wins integer, losses integer, draws integer, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $playora_rpc$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit,25),1),100);
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_game_id is null or p_economy_mode not in ('free','paid') or not exists (
    select 1 from public.catalog_games g where g.id=p_game_id and g.is_enabled=true
  ) then
    raise exception 'game_not_available' using errcode = '22023';
  end if;
  return query
  select
    pg_catalog.row_number() over (
      order by s.competitive_rating desc,s.xp desc,s.wins desc,s.updated_at asc,s.user_id
    )::bigint,
    p.username,p.display_name,s.xp,s.competitive_rating,s.matches_played,s.wins,s.losses,s.draws,s.updated_at
  from public.member_game_stats s
  join public.member_profiles p on p.user_id=s.user_id
  where s.game_id=p_game_id and s.economy_mode=p_economy_mode and s.matches_played>0
  order by s.competitive_rating desc,s.xp desc,s.wins desc,s.updated_at asc,s.user_id
  limit v_limit;
end;
$;
revoke all on function public.get_game_leaderboard_for_mode(text,text,integer) from public,anon,authenticated;


-- New accounts receive 50 Value Wallet coins (USD 0.50 at 100 coins/USD).
-- The gift is recorded as signup_bonus, not as a user deposit.
create or replace function public.handle_new_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_locale text;
  safe_display_name text;
  generated_username text;
begin
  safe_locale := case when new.raw_user_meta_data ->> 'locale' in ('en','fa') then new.raw_user_meta_data ->> 'locale' else 'en' end;
  safe_display_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'),''),'Player'),32);
  generated_username := 'player_' || substr(md5(new.id::text),1,16);

  insert into public.member_profiles(user_id,username,display_name,locale)
  values(new.id,generated_username,safe_display_name,safe_locale)
  on conflict (user_id) do nothing;

  insert into public.member_preferences(user_id,locale)
  values(new.id,safe_locale)
  on conflict (user_id) do nothing;

  insert into public.coin_wallets(user_id,free_coins,purchased_coins,reward_coins)
  values(new.id,0,50,0)
  on conflict (user_id) do nothing;

  insert into public.coin_ledger(user_id,amount,bucket,event_type,idempotency_key)
  values(new.id,50,'purchased','signup_bonus','signup_bonus:' || new.id::text)
  on conflict (idempotency_key) do nothing;

  insert into public.member_game_stats(user_id,game_id,economy_mode)
  values(new.id,'tictactoe','free'),(new.id,'tictactoe','paid')
  on conflict (user_id,game_id,economy_mode) do nothing;

  return new;
end;
$playora_rpc$;
revoke all on function public.handle_new_member() from public,anon,authenticated;

-- Migrate untouched former welcome gifts: move at most 50 coins from Free to Value.
-- Accounts that already spent/earned free coins keep their historical free balance intact.
create temporary table playora_untouched_signup_gifts on commit drop as
select w.user_id, 50::bigint as coins_to_move
from public.coin_wallets w
join public.coin_ledger l on l.user_id=w.user_id and l.bucket='free'
group by w.user_id,w.free_coins
having w.free_coins >= 50
   and sum(l.amount)=w.free_coins
   and bool_and(
     l.event_type='signup_bonus'
     or (l.event_type='promotion' and l.idempotency_key='signup_bonus_adjustment_55:' || w.user_id::text)
   );

with debited as (
  insert into public.coin_ledger(user_id,amount,bucket,event_type,idempotency_key,reference_id)
  select user_id,-coins_to_move,'free','admin_adjustment',
         'signup_paid_conversion_debit:' || user_id::text,
         'Move untouched legacy signup gift to the Value Wallet'
  from playora_untouched_signup_gifts
  on conflict(idempotency_key) do nothing
  returning user_id
),
credited as (
  insert into public.coin_ledger(user_id,amount,bucket,event_type,idempotency_key,reference_id)
  select d.user_id,c.coins_to_move,'purchased','admin_adjustment',
         'signup_paid_conversion_credit:' || d.user_id::text,
         'Move untouched legacy signup gift to the Value Wallet'
  from debited d
  join playora_untouched_signup_gifts c on c.user_id=d.user_id
  on conflict(idempotency_key) do nothing
  returning user_id
)
update public.coin_wallets w
set free_coins=w.free_coins-c.coins_to_move,
    purchased_coins=w.purchased_coins+c.coins_to_move,
    updated_at=now()
from credited x
join playora_untouched_signup_gifts c on c.user_id=x.user_id
where w.user_id=x.user_id;

-- Rewards are a legacy sub-bucket of the Free Wallet. Preserve the historical ledger,
-- but consolidate its remaining balance into free_coins for the two-wallet product model.
insert into public.coin_ledger(user_id,amount,bucket,event_type,idempotency_key,reference_id)
select user_id,-reward_coins,'reward','admin_adjustment',
       'legacy_reward_to_free_debit:' || user_id::text,
       'Consolidate legacy reward balance into Free Wallet'
from public.coin_wallets
where reward_coins>0
on conflict(idempotency_key) do nothing;
insert into public.coin_ledger(user_id,amount,bucket,event_type,idempotency_key,reference_id)
select user_id,reward_coins,'free','admin_adjustment',
       'legacy_reward_to_free_credit:' || user_id::text,
       'Consolidate legacy reward balance into Free Wallet'
from public.coin_wallets
where reward_coins>0
on conflict(idempotency_key) do nothing;
update public.coin_wallets
set free_coins=free_coins+reward_coins,reward_coins=0,updated_at=now()
where reward_coins>0;

-- Make both track rows available for existing members without changing past results.
insert into public.member_game_stats(user_id,game_id,economy_mode)
select p.user_id,g.id,'paid'
from public.member_profiles p cross join public.catalog_games g
on conflict(user_id,game_id,economy_mode) do nothing;

alter table public.coin_wallets alter column free_coins set default 0;
alter table public.coin_wallets alter column purchased_coins set default 0;
comment on column public.coin_wallets.free_coins is 'Free Wallet balance; promotional and ad rewards belong here.';
comment on column public.coin_wallets.purchased_coins is 'Value Wallet balance; verified deposits and the signup gift are recorded here.';

commit;

-- Seed both economy tracks for every catalog game and future member.
-- This keeps empty tracks visible and supports adding a game without schema changes.
begin;

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
  select new.id,g.id,m.economy_mode
  from public.catalog_games g
  cross join (values ('free'::text),('paid'::text)) as m(economy_mode)
  on conflict (user_id,game_id,economy_mode) do nothing;

  return new;
end;
$$;
revoke all on function public.handle_new_member() from public,anon,authenticated;

create or replace function public.seed_catalog_game_progression_tracks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.member_game_stats(user_id,game_id,economy_mode)
  select p.user_id,new.id,m.economy_mode
  from public.member_profiles p
  cross join (values ('free'::text),('paid'::text)) as m(economy_mode)
  on conflict (user_id,game_id,economy_mode) do nothing;
  return new;
end;
$$;
revoke all on function public.seed_catalog_game_progression_tracks() from public,anon,authenticated;
drop trigger if exists catalog_game_seed_progression_tracks on public.catalog_games;
create trigger catalog_game_seed_progression_tracks
after insert on public.catalog_games
for each row execute function public.seed_catalog_game_progression_tracks();

insert into public.member_game_stats(user_id,game_id,economy_mode)
select p.user_id,g.id,m.economy_mode
from public.member_profiles p
cross join public.catalog_games g
cross join (values ('free'::text),('paid'::text)) as m(economy_mode)
on conflict (user_id,game_id,economy_mode) do nothing;

create index if not exists member_game_stats_global_progress_idx
on public.member_game_stats(user_id,economy_mode,xp desc,competitive_rating desc);

-- This read-only RPC deliberately exposes only public leaderboard fields and is
-- available to signed-in members; game catalog enablement remains separately gated.
grant execute on function public.get_game_leaderboard_for_mode(text,text,integer) to authenticated;

commit;

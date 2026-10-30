-- Playora account progression presentation and 55-coin welcome grant.
-- Keeps wallet writes server-owned; existing users receive a one-time +5 make-good.
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
  values(new.id,55,0,0)
  on conflict (user_id) do nothing;

  insert into public.coin_ledger(user_id,amount,bucket,event_type,idempotency_key)
  values(new.id,55,'free','signup_bonus','signup_bonus:' || new.id::text)
  on conflict (idempotency_key) do nothing;

  -- Create a private, zeroed stats row so every new member sees a real initial rating.
  insert into public.member_game_stats(user_id,game_id)
  values(new.id,'tictactoe')
  on conflict (user_id,game_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_member() from public, anon, authenticated;

-- Existing accounts originally received 50 free coins. Credit exactly five more,
-- once, based on the immutable original signup ledger event. Never reset a spent balance.
with eligible as (
  select w.user_id
  from public.coin_wallets w
  join public.coin_ledger signup
    on signup.user_id = w.user_id
   and signup.bucket = 'free'
   and signup.event_type = 'signup_bonus'
   and signup.amount = 50
   and signup.idempotency_key = 'signup_bonus:' || w.user_id::text
  where not exists (
    select 1 from public.coin_ledger adjustment
    where adjustment.idempotency_key = 'signup_bonus_adjustment_55:' || w.user_id::text
  )
),
credited as (
  insert into public.coin_ledger(user_id,amount,bucket,event_type,idempotency_key,reference_id)
  select user_id,5,'free','promotion',
         'signup_bonus_adjustment_55:' || user_id::text,
         'One-time adjustment of original signup gift from 50 to 55'
  from eligible
  on conflict (idempotency_key) do nothing
  returning user_id
)
update public.coin_wallets w
set free_coins = w.free_coins + 5,
    updated_at = now()
from credited c
where w.user_id = c.user_id;

comment on column public.coin_wallets.free_coins is
  'Promotional/free coins. New account welcome grant is 55; not withdrawable.';
comment on column public.coin_wallets.purchased_coins is
  'Purchased coins credited only after a verified payment event; no client-side writes.';
comment on column public.coin_wallets.reward_coins is
  'Promotional or game reward coins credited only by trusted server workflows.';

commit;

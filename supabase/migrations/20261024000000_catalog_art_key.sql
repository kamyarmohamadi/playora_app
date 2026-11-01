-- Keep display-art selection in catalog data so catalog additions/removals do not require host code edits.
-- Art keys are metadata only and never authorize loading or executing a game.
begin;
alter table public.catalog_games
  add column art_key text not null default 'tic'
  check (art_key in ('chess','pool','ludo','checkers','cards','backgammon','tic','rummy'));

update public.catalog_games
set art_key = case id
  when 'chess' then 'chess'
  when 'pool' then 'pool'
  when 'ludo' then 'ludo'
  when 'checkers' then 'checkers'
  when 'hokm' then 'cards'
  when 'backgammon' then 'backgammon'
  when 'tictactoe' then 'tic'
  when 'rummy' then 'rummy'
  else 'tic'
end;
commit;

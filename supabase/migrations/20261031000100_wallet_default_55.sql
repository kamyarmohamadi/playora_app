-- Keep all new wallet creation paths aligned with the 55-coin welcome grant.
alter table public.coin_wallets
  alter column free_coins set default 55;

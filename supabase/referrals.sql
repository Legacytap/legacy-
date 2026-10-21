-- Username-based referral attribution and private referral lists.
create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint player_profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);

create table if not exists public.player_referrals (
  referred_user_id uuid primary key references auth.users(id) on delete cascade,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint player_referrals_not_self check (referred_user_id <> referrer_user_id)
);
create index if not exists player_referrals_referrer_idx on public.player_referrals(referrer_user_id, created_at desc);

alter table public.player_profiles enable row level security;
alter table public.player_referrals enable row level security;
revoke all on public.player_profiles from anon, authenticated;
revoke all on public.player_referrals from anon, authenticated;
-- Only the referrals Edge Function (service role) may read/write these tables.

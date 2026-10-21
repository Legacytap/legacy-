-- LEGACY Supabase schema + hardened payment crediting. Run in SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.player_progress (
 user_id uuid primary key references auth.users(id) on delete cascade,
 coins bigint not null default 0 check (coins >= 0),
 energy integer not null default 100 check (energy between 0 and 100),
 power integer not null default 1 check (power >= 1),
 upgrade_cost bigint not null default 50 check (upgrade_cost >= 50),
 last_reward text not null default '',
 updated_at timestamptz not null default now()
);
create table if not exists public.wallet_links (
 user_id uuid primary key references auth.users(id) on delete cascade,
 wallet_address text not null unique,
 created_at timestamptz not null default now()
);
create table if not exists public.sol_quotes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 wallet_address text not null,
 refills integer not null check (refills in (3,6,9,12,30,60)),
 amount_lamports bigint not null check (amount_lamports > 0),
 recipient text not null,
 expires_at timestamptz not null,
 used_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.sol_payments (
 signature text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 quote_id uuid not null unique references public.sol_quotes(id),
 refills integer not null,
 amount_lamports bigint not null,
 confirmed_at timestamptz not null default now()
);

-- Safe to apply to an older starter schema.
alter table public.sol_quotes drop constraint if exists sol_quotes_refills_check;
alter table public.sol_quotes add constraint sol_quotes_refills_check check (refills in (3,6,9,12,30,60));

alter table public.player_progress enable row level security;
alter table public.wallet_links enable row level security;
alter table public.sol_quotes enable row level security;
alter table public.sol_payments enable row level security;

drop policy if exists "players read own progress" on public.player_progress;
drop policy if exists "players insert own progress" on public.player_progress;
drop policy if exists "players update own progress" on public.player_progress;
drop policy if exists "players manage own wallet link" on public.wallet_links;
drop policy if exists "players read own quotes" on public.sol_quotes;
drop policy if exists "players read own payments" on public.sol_payments;
create policy "players read own progress" on public.player_progress for select to authenticated using (auth.uid()=user_id);
-- WARNING: client progress writes remain enabled for this starter build. Do not treat coins/energy as valuable or launch a competitive economy until writes are moved server-side.
create policy "players insert own progress" on public.player_progress for insert to authenticated with check (auth.uid()=user_id);
create policy "players update own progress" on public.player_progress for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "players manage own wallet link" on public.wallet_links for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "players read own quotes" on public.sol_quotes for select to authenticated using (auth.uid()=user_id);
create policy "players read own payments" on public.sol_payments for select to authenticated using (auth.uid()=user_id);

-- Atomic, idempotent payment recording + energy credit. Only service_role should call this function.
create or replace function public.apply_verified_sol_payment(
 p_signature text,
 p_user_id uuid,
 p_quote_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
 q public.sol_quotes%rowtype;
 existing public.sol_payments%rowtype;
 new_energy integer;
begin
 select * into q from public.sol_quotes where id = p_quote_id and user_id = p_user_id for update;
 if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
 if q.used_at is not null then
   select * into existing from public.sol_payments where quote_id = q.id;
   if found and existing.signature = p_signature then
     return jsonb_build_object('success', true, 'already_processed', true, 'refills', existing.refills);
   end if;
   raise exception 'QUOTE_ALREADY_USED';
 end if;
 if q.expires_at < now() then raise exception 'QUOTE_EXPIRED'; end if;
 if exists (select 1 from public.sol_payments where signature = p_signature) then raise exception 'SIGNATURE_ALREADY_USED'; end if;
 insert into public.sol_payments(signature,user_id,quote_id,refills,amount_lamports)
 values (p_signature,p_user_id,q.id,q.refills,q.amount_lamports);
 insert into public.player_progress(user_id,energy)
 values (p_user_id, least(100,q.refills))
 on conflict (user_id) do update
 set energy = least(100, public.player_progress.energy + q.refills), updated_at = now();
 select energy into new_energy from public.player_progress where user_id = p_user_id;
 update public.sol_quotes set used_at = now() where id = q.id;
 return jsonb_build_object('success', true, 'already_processed', false, 'refills', q.refills, 'energy', new_energy);
end;
$$;
revoke all on function public.apply_verified_sol_payment(text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.apply_verified_sol_payment(text,uuid,uuid) to service_role;

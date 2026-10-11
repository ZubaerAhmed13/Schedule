-- Weekwise invite-code enforcement for Supabase
-- Run this once in Supabase Dashboard -> SQL Editor.
-- It is designed to work with the Weekwise sign-up flow, which sends
-- auth.users.raw_user_meta_data->>'weekwise_referral_code'.
--
-- The actual invite is stored as a SHA-256 hash, not as plain text.
-- Initial invite code is shared privately with the Weekwise owner.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.weekwise_invite_codes (
  code_hash text primary key,
  is_active boolean not null default true,
  use_count bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table private.weekwise_invite_codes enable row level security;
revoke all on table private.weekwise_invite_codes from public, anon, authenticated;

-- Active invite code hash. The matching raw code is not stored in this file.
insert into private.weekwise_invite_codes (code_hash, is_active)
values ('1d86e1797ae13b92da7e6a09525681fc82db021b530a03ebeb2d981af1756d0f', true)
on conflict (code_hash) do update set is_active = true;

create or replace function public.weekwise_require_referral_code()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, private
as $function$
declare
  submitted_code text;
  submitted_hash text;
begin
  submitted_code := upper(btrim(coalesce(new.raw_user_meta_data ->> 'weekwise_referral_code', '')));

  if submitted_code = '' then
    raise exception 'A Weekwise referral code is required to create an account.'
      using errcode = 'P0001';
  end if;

  submitted_hash := encode(digest(submitted_code, 'sha256'), 'hex');

  update private.weekwise_invite_codes
     set use_count = use_count + 1
   where code_hash = submitted_hash
     and is_active = true;

  if not found then
    raise exception 'Invalid Weekwise referral code. Request an invite code from the Weekwise owner.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

revoke all on function public.weekwise_require_referral_code() from public, anon, authenticated;

drop trigger if exists weekwise_require_referral_code on auth.users;
create trigger weekwise_require_referral_code
before insert on auth.users
for each row
execute function public.weekwise_require_referral_code();

-- To disable this invite in future:
-- update private.weekwise_invite_codes
-- set is_active = false
-- where code_hash = '1d86e1797ae13b92da7e6a09525681fc82db021b530a03ebeb2d981af1756d0f';

-- Reviewed invitation enforcement. Existing accounts/planners are never rewritten.
-- Preserve the original privately distributed invite's hash; generate a separate
-- owner invitation inside Vault, never in a browser bundle or operator response.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table if not exists private.weekwise_invite_codes (
 code_hash text primary key,is_active boolean not null default true,
 use_count bigint not null default 0,created_at timestamptz not null default now()
);
alter table private.weekwise_invite_codes add column if not exists expires_at timestamptz;
alter table private.weekwise_invite_codes add column if not exists max_uses bigint;
alter table private.weekwise_invite_codes add column if not exists check_id uuid;
alter table private.weekwise_invite_codes enable row level security;
revoke all on private.weekwise_invite_codes from public,anon,authenticated;
create index if not exists weekwise_invite_check_id_idx on private.weekwise_invite_codes(check_id) where check_id is not null;
insert into private.weekwise_invite_codes(code_hash)
 values('1d86e1797ae13b92da7e6a09525681fc82db021b530a03ebeb2d981af1756d0f') on conflict do nothing;
do $bootstrap$ declare owner_code text;begin
 select decrypted_secret into owner_code from vault.decrypted_secrets where name='weekwise_owner_invite_code';
 if owner_code is null then
  owner_code=upper(encode(extensions.gen_random_bytes(32),'hex'));
  perform vault.create_secret(owner_code,'weekwise_owner_invite_code','Weekwise owner invitation; share privately, rotate/revoke deliberately.');
 end if;
 insert into private.weekwise_invite_codes(code_hash) values(encode(extensions.digest(owner_code,'sha256'),'hex')) on conflict do nothing;
end;$bootstrap$;
create or replace function private.weekwise_require_referral_code()
returns trigger language plpgsql security definer set search_path=pg_catalog as $function$
declare submitted text;begin
 submitted=upper(btrim(coalesce(new.raw_user_meta_data->>'weekwise_referral_code','')));
 if length(submitted)<1 or length(submitted)>64 then
  raise exception 'A valid Weekwise invitation is required.' using errcode='P0001';
 end if;
 -- The submitted code is untrusted input, never a role/owner claim. The private
 -- hash and one atomic conditional UPDATE decide whether signup is permitted.
 update private.weekwise_invite_codes set use_count=use_count+1
 where code_hash=encode(extensions.digest(submitted,'sha256'),'hex') and is_active
 and (expires_at is null or expires_at>now()) and (max_uses is null or use_count<max_uses);
 if not found then raise exception 'A valid Weekwise invitation is required.' using errcode='P0001';end if;
 return new;
end;$function$;
revoke all on function private.weekwise_require_referral_code() from public,anon,authenticated;
drop trigger if exists weekwise_require_referral_code on auth.users;
create trigger weekwise_require_referral_code before insert on auth.users
 for each row execute function private.weekwise_require_referral_code();

-- A gated server check creates its own bounded invitations and cleans only its
-- unique check group. These RPCs never return owner invitations.
create or replace function public.weekwise_prepare_backend_check_invites()
returns jsonb language plpgsql security definer set search_path=pg_catalog as $function$
declare id uuid=extensions.gen_random_uuid();valid text;revoked text;expired text;begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 valid=upper(encode(extensions.gen_random_bytes(32),'hex'));
 revoked=upper(encode(extensions.gen_random_bytes(32),'hex'));
 expired=upper(encode(extensions.gen_random_bytes(32),'hex'));
 insert into private.weekwise_invite_codes(code_hash,is_active,max_uses,expires_at,check_id) values
 (encode(extensions.digest(valid,'sha256'),'hex'),true,2,now()+interval '15 minutes',id),
 (encode(extensions.digest(revoked,'sha256'),'hex'),false,1,now()+interval '15 minutes',id),
 (encode(extensions.digest(expired,'sha256'),'hex'),true,1,now()-interval '1 minute',id);
 return jsonb_build_object('check_id',id,'valid',valid,'revoked',revoked,'expired',expired);
end;$function$;
create or replace function public.weekwise_cleanup_backend_check_invites(p_check_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog as $function$
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 if p_check_id is null then raise invalid_parameter_value;end if;
 delete from private.weekwise_invite_codes where check_id=p_check_id;
 return true;
end;$function$;
revoke all on function public.weekwise_prepare_backend_check_invites(),public.weekwise_cleanup_backend_check_invites(uuid) from public,anon,authenticated;
grant execute on function public.weekwise_prepare_backend_check_invites(),public.weekwise_cleanup_backend_check_invites(uuid) to service_role;

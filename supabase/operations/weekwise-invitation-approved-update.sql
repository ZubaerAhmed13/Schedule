begin;
create temporary table weekwise_invite_guard(table_name text primary key,rows bigint,fingerprint text) on commit drop;
insert into weekwise_invite_guard select 'auth.users',count(*),md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by md5(to_jsonb(r)::text)),'')) from auth.users r;
insert into weekwise_invite_guard select 'public.weekwise_cloud_data',count(*),md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by md5(to_jsonb(r)::text)),'')) from public.weekwise_cloud_data r;
insert into weekwise_invite_guard select 'public.weekwise_push_subscriptions',count(*),md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by md5(to_jsonb(r)::text)),'')) from public.weekwise_push_subscriptions r;
insert into weekwise_invite_guard select 'public.weekwise_push_delivery_log',count(*),md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by md5(to_jsonb(r)::text)),'')) from public.weekwise_push_delivery_log r;
insert into weekwise_invite_guard select 'public.weekwise_calendar_oauth_states',count(*),md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by md5(to_jsonb(r)::text)),'')) from public.weekwise_calendar_oauth_states r;
insert into weekwise_invite_guard select 'public.weekwise_calendar_connections',count(*),md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by md5(to_jsonb(r)::text)),'')) from public.weekwise_calendar_connections r;
insert into weekwise_invite_guard select 'public.weekwise_calendar_event_links',count(*),md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by md5(to_jsonb(r)::text)),'')) from public.weekwise_calendar_event_links r;
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

-- Prevent one authenticated browser from moving a known push endpoint to its
-- account. The service passes its verified owner; conflict ownership is atomic.
create or replace function public.weekwise_register_push_subscription(
 p_owner uuid,p_endpoint text,p_subscription jsonb,p_timezone text,p_user_agent text
) returns boolean language plpgsql security definer set search_path=pg_catalog as $function$
declare inserted text;begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 if p_owner is null or p_endpoint is null or p_endpoint not like 'https://%' or length(p_endpoint)>4096
 or jsonb_typeof(p_subscription) is distinct from 'object' or p_subscription->>'endpoint' is distinct from p_endpoint
 or p_timezone is null or length(p_timezone)>100 then raise invalid_parameter_value;end if;
 insert into public.weekwise_push_subscriptions(endpoint,user_id,subscription,timezone,user_agent,updated_at)
 values(p_endpoint,p_owner,p_subscription,p_timezone,left(p_user_agent,300),now())
 on conflict(endpoint) do update set subscription=excluded.subscription,timezone=excluded.timezone,
 user_agent=excluded.user_agent,updated_at=excluded.updated_at
 where public.weekwise_push_subscriptions.user_id=excluded.user_id
 returning endpoint into inserted;
 return inserted is not null;
end;$function$;
revoke all on function public.weekwise_register_push_subscription(uuid,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.weekwise_register_push_subscription(uuid,text,jsonb,text,text) to service_role;

do $preserved$ declare old record;current_count bigint;current_hash text;begin for old in select * from weekwise_invite_guard loop execute format('select count(*),md5(coalesce(string_agg(md5(to_jsonb(r)::text),'''' order by md5(to_jsonb(r)::text)),'''')) from %s r',old.table_name) into current_count,current_hash;if current_count<>old.rows or current_hash<>old.fingerprint then raise exception 'Existing Weekwise data changed during invitation migration; transaction rolled back.';end if;end loop;end;$preserved$;
commit;

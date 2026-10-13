-- Encrypted server-only configuration. Secret values are generated in the backend,
-- never returned to browser roles or embedded in source, logs, or client bundles.
create schema if not exists private;
create table if not exists private.weekwise_runtime_flags(name text primary key,value boolean not null);
alter table private.weekwise_runtime_flags enable row level security;
revoke all on private.weekwise_runtime_flags from public,anon,authenticated;
grant usage on schema private to service_role;
grant select on private.weekwise_runtime_flags to service_role;
insert into private.weekwise_runtime_flags(name,value) values('account_erasure_enabled',false) on conflict(name) do nothing;

do $seed$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('weekwise-runtime-config',0));
 if not exists(select 1 from vault.secrets where name='weekwise_push_cron_secret') then
  perform vault.create_secret(pg_catalog.encode(extensions.gen_random_bytes(32),'hex'),'weekwise_push_cron_secret','Weekwise dispatcher authentication; server generated');
 end if;
 if not exists(select 1 from vault.secrets where name='WEEKWISE_CALENDAR_ENCRYPTION_KEY') then
  perform vault.create_secret(pg_catalog.rtrim(pg_catalog.translate(pg_catalog.encode(extensions.gen_random_bytes(32),'base64'),'+/','-_'),'='),'WEEKWISE_CALENDAR_ENCRYPTION_KEY','Stable Weekwise calendar token encryption key; preserve during upgrades');
 end if;
 if not exists(select 1 from vault.secrets where name='VAPID_SUBJECT') then
  perform vault.create_secret('https://zubaerahmed13.github.io/Schedule/','VAPID_SUBJECT','Public Weekwise application contact URL');
 end if;
end;
$seed$;

create or replace function public.weekwise_runtime_configuration(p_names text[])
returns jsonb language plpgsql security definer set search_path=pg_catalog as $function$
declare result jsonb;
begin
 if p_names is null or cardinality(p_names)>11 or exists(select 1 from unnest(p_names) name where name is null or name<>all(array['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT','WEEKWISE_PUSH_CRON_SECRET','WEEKWISE_CALENDAR_ENCRYPTION_KEY','GOOGLE_CALENDAR_CLIENT_ID','GOOGLE_CALENDAR_CLIENT_SECRET','MICROSOFT_CALENDAR_CLIENT_ID','MICROSOFT_CALENDAR_CLIENT_SECRET','MICROSOFT_CALENDAR_TENANT','WEEKWISE_ACCOUNT_ERASURE_ENABLED'])) then
  raise exception 'Unknown Weekwise server configuration key.' using errcode='22023';
 end if;
 select coalesce(jsonb_object_agg(keys.name,secrets.decrypted_secret),'{}'::jsonb) into result
 from unnest(p_names) keys(name) join vault.decrypted_secrets secrets
 on secrets.name=case keys.name when 'WEEKWISE_PUSH_CRON_SECRET' then 'weekwise_push_cron_secret' else keys.name end;
 if 'WEEKWISE_ACCOUNT_ERASURE_ENABLED'=any(p_names) then
  result=result||jsonb_build_object('WEEKWISE_ACCOUNT_ERASURE_ENABLED',coalesce((select value from private.weekwise_runtime_flags where name='account_erasure_enabled'),false)::text);
 end if;
 return result;
end;
$function$;
revoke all on function public.weekwise_runtime_configuration(text[]) from public,anon,authenticated;
grant execute on function public.weekwise_runtime_configuration(text[]) to service_role;

create or replace function public.weekwise_install_vapid_keys(p_public text,p_private text,p_project_url text default null)
returns boolean language plpgsql security definer set search_path=pg_catalog as $function$
declare existing_public boolean;existing_private boolean;
begin
 if p_public is null or p_public!~'^[A-Za-z0-9_-]{87}$' or p_private is null or p_private!~'^[A-Za-z0-9_-]{43}$' then
  raise exception 'Invalid VAPID configuration.' using errcode='22023';
 end if;
 if p_project_url is not null and p_project_url!~'^https://[a-z0-9]{20}\.supabase\.co$' then
  raise exception 'Invalid Weekwise project URL.' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('weekwise-runtime-config',0));
 select exists(select 1 from vault.secrets where name='VAPID_PUBLIC_KEY'),exists(select 1 from vault.secrets where name='VAPID_PRIVATE_KEY') into existing_public,existing_private;
 if existing_public<>existing_private then raise exception 'Incomplete existing VAPID pair; manual review required.';end if;
 if p_project_url is not null and not exists(select 1 from vault.secrets where name='weekwise_project_url') then
  perform vault.create_secret(p_project_url,'weekwise_project_url','Weekwise Edge Function project URL');
 end if;
 if existing_public then return false;end if;
 perform vault.create_secret(p_public,'VAPID_PUBLIC_KEY','Weekwise Web Push public key');
 perform vault.create_secret(p_private,'VAPID_PRIVATE_KEY','Weekwise Web Push private key; server generated');
 return true;
end;
$function$;
revoke all on function public.weekwise_install_vapid_keys(text,text,text) from public,anon,authenticated;
grant execute on function public.weekwise_install_vapid_keys(text,text,text) to service_role;

-- One-time disposable-identity activation checks; disabled unless the operator starts one.
insert into private.weekwise_runtime_flags(name,value) values('activation_check_enabled',false) on conflict(name) do nothing;
create table if not exists private.weekwise_activation_checks(id bigint generated always as identity primary key,created_at timestamptz not null default now(),passed boolean not null,report jsonb not null);
alter table private.weekwise_activation_checks enable row level security;
revoke all on private.weekwise_activation_checks from public,anon,authenticated;
create or replace function public.weekwise_claim_activation_check()
returns boolean language plpgsql security definer set search_path=pg_catalog as $function$
begin
 update private.weekwise_runtime_flags set value=false where name='activation_check_enabled' and value=true;
 return found;
end;
$function$;
revoke all on function public.weekwise_claim_activation_check() from public,anon,authenticated;
grant execute on function public.weekwise_claim_activation_check() to service_role;

create or replace function public.weekwise_set_erasure_enabled(p_enabled boolean)
returns void language plpgsql security definer set search_path=pg_catalog as $function$
declare target text;
begin
 if p_enabled is null then raise exception 'Choose an explicit erasure state.';end if;
 if p_enabled then
  foreach target in array array['weekwise_cloud_data','weekwise_push_subscriptions','weekwise_push_delivery_log','weekwise_calendar_oauth_states','weekwise_calendar_connections','weekwise_calendar_event_links'] loop
   if not exists(select 1 from pg_constraint c join pg_attribute child on child.attrelid=c.conrelid and child.attnum=c.conkey[1] join pg_attribute parent on parent.attrelid=c.confrelid and parent.attnum=c.confkey[1] where c.contype='f' and c.conrelid=to_regclass('public.'||target) and c.confrelid='auth.users'::regclass and c.convalidated and c.confdeltype='c' and cardinality(c.conkey)=1 and cardinality(c.confkey)=1 and child.attname='user_id' and parent.attname='id') then
    raise exception 'Missing validated Weekwise owner cascade; erasure remains disabled.';
   end if;
  end loop;
  if exists(select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where c.contype='f' and c.confrelid='auth.users'::regclass and n.nspname<>'auth' and not(n.nspname='public' and t.relname=any(array['weekwise_cloud_data','weekwise_push_subscriptions','weekwise_push_delivery_log','weekwise_calendar_oauth_states','weekwise_calendar_connections','weekwise_calendar_event_links']))) then
   raise exception 'Additional user-dependent tables require review before erasure.';
  end if;
 end if;
 update private.weekwise_runtime_flags set value=p_enabled where name='account_erasure_enabled';
 if not found then raise exception 'Weekwise runtime flags are missing.';end if;
end;
$function$;
revoke all on function public.weekwise_set_erasure_enabled(boolean) from public,anon,authenticated;
grant execute on function public.weekwise_set_erasure_enabled(boolean) to service_role;

create or replace function public.weekwise_record_activation_check(p_passed boolean,p_report jsonb)
returns void language plpgsql security definer set search_path=pg_catalog as $function$
begin
 if p_passed is null or jsonb_typeof(p_report)<>'object' or octet_length(p_report::text)>8192 or exists(select 1 from jsonb_each(p_report) entry where entry.key!~'^[a-z_]{1,64}$' or jsonb_typeof(entry.value)<>'boolean') then
  raise exception 'Activation reports must contain bounded boolean checks only.';
 end if;
 insert into private.weekwise_activation_checks(passed,report) values(p_passed,p_report);
end;
$function$;
revoke all on function public.weekwise_record_activation_check(boolean,jsonb) from public,anon,authenticated;
grant execute on function public.weekwise_record_activation_check(boolean,jsonb) to service_role;

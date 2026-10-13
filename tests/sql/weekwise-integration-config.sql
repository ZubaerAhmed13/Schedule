-- Disposable PostgreSQL fixture: validates access/SQL contracts, not Vault encryption.
create role service_role bypassrls;
create schema extensions;
create extension pgcrypto with schema extensions;
create schema vault;
create table vault.secrets(id uuid primary key default extensions.gen_random_uuid(),name text unique,secret text);
create view vault.decrypted_secrets as select id,name,secret as decrypted_secret from vault.secrets;
revoke all on vault.secrets,vault.decrypted_secrets from public,anon,authenticated;
create function vault.create_secret(secret text,name text default null,description text default null) returns uuid language plpgsql as $$declare result uuid;begin insert into vault.secrets(name,secret) values(name,secret) returning id into result;return result;end;$$;
create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
\ir ../../supabase_push_setup.sql
\ir ../../supabase_calendar_setup.sql
\ir ../../supabase/migrations/20261013135248_weekwise_runtime_configuration.sql
-- Repeat setup must preserve keys/flags.
create temporary table config_before as select name,secret from vault.secrets;
\ir ../../supabase/migrations/20261013135248_weekwise_runtime_configuration.sql
do $test$ begin
 assert (select count(*) from vault.secrets)=4,'only expected initial secret names';
 assert not exists(select 1 from config_before b join vault.secrets v using(name) where b.secret<>v.secret),'reapplying must preserve secret values';
end; $test$;
update private.weekwise_runtime_flags set value=true where name='activation_check_enabled';
set role service_role;
set request.jwt.claim.role='service_role';
do $test$ declare cfg jsonb; installed boolean;begin
 assert public.weekwise_claim_activation_check(),'operator-enabled activation check claims once';assert not public.weekwise_claim_activation_check(),'second activation claim must fail';
 cfg=public.weekwise_runtime_configuration(array['WEEKWISE_CALENDAR_ENCRYPTION_KEY','WEEKWISE_ACCOUNT_ERASURE_ENABLED']);
 assert length(cfg->>'WEEKWISE_CALENDAR_ENCRYPTION_KEY')=43,'stable 32-byte encryption key';
 assert cfg->>'WEEKWISE_ACCOUNT_ERASURE_ENABLED'='false','erasure starts disabled';
 perform public.weekwise_set_erasure_enabled(true);perform public.weekwise_set_erasure_enabled(false);
 installed=public.weekwise_install_vapid_keys(repeat('b',87),repeat('a',43),'https://abcdefghijklmnopqrst.supabase.co');assert installed,'first valid configuration installs';
 installed=public.weekwise_install_vapid_keys(repeat('c',87),repeat('d',43),'https://abcdefghijklmnopqrst.supabase.co');assert not installed,'second install must not rotate';
 cfg=public.weekwise_runtime_configuration(array['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY']);assert cfg->>'VAPID_PUBLIC_KEY'=repeat('b',87) and cfg->>'VAPID_PRIVATE_KEY'=repeat('a',43),'winning pair remains intact';
 begin perform public.weekwise_runtime_configuration(array['UNKNOWN']);raise exception 'Unknown key accepted';exception when invalid_parameter_value then null;end;
end; $test$;
reset role;
set role authenticated;
do $test$ begin
 begin perform public.weekwise_runtime_configuration(array['VAPID_PRIVATE_KEY']);raise exception 'Browser read config';exception when insufficient_privilege then null;end;
 begin perform public.weekwise_install_vapid_keys(repeat('c',87),repeat('d',43),null);raise exception 'Browser installed keys';exception when insufficient_privilege then null;end;
 begin perform 1 from private.weekwise_runtime_flags;raise exception 'Browser read flags';exception when insufficient_privilege then null;end;
 begin perform 1 from public.weekwise_calendar_connections;raise exception 'Browser read calendar tokens';exception when insufficient_privilege then null;end;
 begin perform 1 from public.weekwise_push_subscriptions;raise exception 'Browser read push subscriptions';exception when insufficient_privilege then null;end;
end; $test$;
reset role;
select 'Server-only runtime configuration and optional schema contracts passed' as result;

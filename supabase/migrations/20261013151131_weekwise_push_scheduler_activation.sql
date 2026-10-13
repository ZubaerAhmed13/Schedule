-- User explicitly approved pg_net and pg_cron minute scheduling on 13 October 2026.
-- Applies only to the reviewed Weekwise backend. No literal credentials are stored.
begin;
do $guard$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='weekwise_project_url' and decrypted_secret='https://iajkzlsurghfvsmqkmut.supabase.co') then raise exception 'Wrong Weekwise project URL; no scheduler installed.';end if;
 if md5(pg_get_functiondef('public.weekwise_save(jsonb,bigint)'::regprocedure))<>'e39c1609a40b05c83002fb3adecfbb38' then raise exception 'Reviewed Weekwise save boundary changed.';end if;
 if not coalesce((select value from private.weekwise_runtime_flags where name='account_erasure_enabled'),false) or not exists(select 1 from private.weekwise_activation_checks where passed and report->>'disposable_identities_cleaned'='true') then raise exception 'Disposable activation acceptance missing.';end if;
end;$guard$;
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $check$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'weekwise_project_url' and nullif(decrypted_secret, '') is not null) then
    raise exception 'Create a Vault secret named weekwise_project_url before installing the Weekwise push cron.';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'weekwise_push_cron_secret' and nullif(decrypted_secret, '') is not null) then
    raise exception 'Create a Vault secret named weekwise_push_cron_secret before installing the Weekwise push cron.';
  end if;
end;
$check$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'weekwise-push-dispatch';

select cron.schedule(
  'weekwise-push-dispatch',
  '* * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'weekwise_project_url') || '/functions/v1/weekwise-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-weekwise-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'weekwise_push_cron_secret')
      ),
      body := jsonb_build_object('action', 'dispatch'),
      timeout_milliseconds := 10000
    );
  $job$
);

commit;

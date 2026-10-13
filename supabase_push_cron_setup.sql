-- Weekwise background push cron setup.
-- Installed in Weekwise after explicit user approval on 13 October 2026.
-- Applied migration: 20261013151217 / weekwise_push_scheduler_activation.
-- Review existing jobs/configuration before re-running this setup.
-- Deploy the push handler and private runtime migration first. Server bootstrap
-- provisions stable VAPID keys, weekwise_project_url and weekwise_push_cron_secret.
-- Keep net unexposed by the Data API; trusted direct database roles can read queued headers.
-- Never replace Vault lookups with literal secrets or commit real secret values.

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

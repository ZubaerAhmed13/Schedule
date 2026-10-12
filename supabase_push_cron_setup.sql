-- Weekwise background push cron setup.
-- BEFORE running this script:
-- 1) Deploy supabase/functions/weekwise-push/index.ts.
-- 2) Set WEEKWISE_PUSH_CRON_SECRET in Edge Function secrets.
-- 3) In Supabase Dashboard -> Vault, create secrets named:
--      weekwise_project_url       value: https://<project-ref>.supabase.co
--      weekwise_push_cron_secret  value: the EXACT same random secret as the Edge Function secret.
-- Never replace these Vault lookups with literal secrets in this file or commit real secrets.

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
      body := jsonb_build_object('action', 'dispatch')
    );
  $job$
);

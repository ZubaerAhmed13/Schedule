-- Reviewable next action. Not executed: pg_net enablement requires explicit approval.
-- First redeploy the checked weekwise-activation-check source; currently it returns 410.
-- pg_net queues decrypted headers. Every database LOGIN role must be trusted;
-- keep net outside the Data API exposed schemas. Do not select request headers.
begin;
create extension if not exists pg_net;
update private.weekwise_runtime_flags set value=true where name='activation_check_enabled';
select net.http_post(
 url:='https://iajkzlsurghfvsmqkmut.supabase.co/functions/v1/weekwise-activation-check',
 headers:=jsonb_build_object('Content-Type','application/json','x-weekwise-activation-secret',
  (select decrypted_secret from vault.decrypted_secrets where name='WEEKWISE_ACTIVATION_CHECK_SECRET')),
 body:='{}'::jsonb,timeout_milliseconds:=60000
) as activation_request_id;
commit;
-- After completion, inspect only the bounded boolean receipt:
select passed,report from private.weekwise_activation_checks order by id desc limit 1;
-- Require passed=true and disposable_identities_cleaned=true before scheduling push.
-- Retire the check function to its 410 handler and ensure activation_check_enabled=false.

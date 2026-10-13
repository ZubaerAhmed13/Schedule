-- Scoped signed check, without pg_net. Historical successful activation is recorded.
-- Redeploy the checked harness only during an authorized disposable-account check.
-- The operator proof expires in 60 seconds and the private flag can be claimed once.
-- The signing secret never leaves Vault. Do not log/persist the derived proof.
with enabled as (
 update private.weekwise_runtime_flags set value=true
 where name='activation_check_enabled' and value=false returning name
),challenge as (
 select extensions.gen_random_uuid()::text as nonce,
 (extract(epoch from clock_timestamp())*1000)::bigint::text as stamp
)
select nonce,stamp,encode(extensions.hmac(
 'weekwise-activation:'||nonce||':'||stamp,
 (select decrypted_secret from vault.decrypted_secrets where name='WEEKWISE_ACTIVATION_CHECK_SECRET'),
 'sha256'),'hex') as proof from challenge cross join enabled;
-- POST {} to /functions/v1/weekwise-activation-check within 60 seconds using
-- x-weekwise-activation-nonce, x-weekwise-activation-time and x-weekwise-activation-proof.
-- Only fresh disposable identities are selected/deleted; no email is sent.
-- Inspect bounded booleans only, then retire the harness to its 410 handler:
select passed,report from private.weekwise_activation_checks order by id desc limit 1;

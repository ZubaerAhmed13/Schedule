-- Weekwise read-only integration diagnostics
-- Run in Supabase Dashboard -> SQL Editor AFTER running both setup scripts.
-- This query makes no changes and never returns user task data or invite hashes.

with checks as (
  select
    'cloud table'::text as check_name,
    case when to_regclass('public.weekwise_cloud_data') is not null then 'PASS' else 'FAIL' end as status,
    case when to_regclass('public.weekwise_cloud_data') is not null
      then 'public.weekwise_cloud_data exists'
      else 'Run weekwise_supabase_setup.sql'
    end as details
  union all
  select
    'cloud save RPC',
    case when to_regprocedure('public.weekwise_save(jsonb,bigint)') is not null then 'PASS' else 'FAIL' end,
    case when to_regprocedure('public.weekwise_save(jsonb,bigint)') is not null
      then 'public.weekwise_save(jsonb,bigint) exists'
      else 'Run weekwise_supabase_setup.sql'
    end
  union all
  select
    'cloud table row-level security',
    case when coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.weekwise_cloud_data')), false) then 'PASS' else 'FAIL' end,
    case when coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.weekwise_cloud_data')), false)
      then 'RLS is enabled on the cloud table'
      else 'Table missing or RLS is disabled; do not enable public access as a workaround'
    end
  union all
  select
    'own-row RLS policies',
    case when (
      select count(*) = 3
      from pg_policies
      where schemaname = 'public'
        and tablename = 'weekwise_cloud_data'
        and 'authenticated' = any(roles)
        and (
          (policyname = 'weekwise_cloud_select_own' and cmd = 'SELECT'
            and coalesce(qual, '') ilike '%auth.uid%' and coalesce(qual, '') ilike '%user_id%')
          or (policyname = 'weekwise_cloud_insert_own' and cmd = 'INSERT'
            and coalesce(with_check, '') ilike '%auth.uid%' and coalesce(with_check, '') ilike '%user_id%')
          or (policyname = 'weekwise_cloud_update_own' and cmd = 'UPDATE'
            and coalesce(qual, '') ilike '%auth.uid%' and coalesce(qual, '') ilike '%user_id%'
            and coalesce(with_check, '') ilike '%auth.uid%' and coalesce(with_check, '') ilike '%user_id%')
        )
    ) then 'PASS' else 'FAIL' end,
    'Expected own-row SELECT, INSERT and UPDATE policies: ' ||
      (select count(*)::text from pg_policies
       where schemaname = 'public'
         and tablename = 'weekwise_cloud_data'
         and policyname in ('weekwise_cloud_select_own','weekwise_cloud_insert_own','weekwise_cloud_update_own')) ||
      ' of 3 found'
  union all
  select
    'authenticated RPC permission',
    case when exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'weekwise_save'
        and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ) then 'PASS' else 'FAIL' end,
    'Signed-in users need EXECUTE on weekwise_save'
  union all
  select
    'anonymous RPC blocked',
    case when exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'weekwise_save'
        and not has_function_privilege('anon', p.oid, 'EXECUTE')
    ) then 'PASS' else 'FAIL' end,
    'Anonymous users should not execute weekwise_save'
  union all
  select
    'invite-code table',
    case when to_regclass('private.weekwise_invite_codes') is not null then 'PASS' else 'NOT CONFIGURED' end,
    case when to_regclass('private.weekwise_invite_codes') is not null
      then 'Private invite table exists; this does not validate a particular code'
      else 'Run supabase_invite_code_setup.sql if invite-only registration is intended'
    end
  union all
  select
    'invite enforcement trigger',
    case when exists (
      select 1
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'auth'
        and c.relname = 'users'
        and t.tgname = 'weekwise_require_referral_code'
        and not t.tgisinternal
        and t.tgenabled <> 'D'
    ) then 'PASS' else 'NOT CONFIGURED' end,
    'The auth.users invite trigger must be enabled if invite-only registration is required'
  union all
  select
    'pgcrypto digest function',
    case when to_regprocedure('extensions.digest(text,text)') is not null then 'PASS'
         when to_regprocedure('public.digest(text,text)') is not null then 'PRESENT IN ANOTHER SCHEMA'
         else 'NOT CONFIGURED' end,
    'The invite setup expects pgcrypto digest in the extensions schema'
  union all
  select
    'background push subscriptions table',
    case when to_regclass('public.weekwise_push_subscriptions') is not null then 'PASS' else 'NOT CONFIGURED' end,
    case when to_regclass('public.weekwise_push_subscriptions') is not null
      then 'Subscription table exists; use Supabase Edge Function for writes'
      else 'Run supabase_push_setup.sql before enabling background reminders'
    end
  union all
  select
    'background push delivery log',
    case when to_regclass('public.weekwise_push_delivery_log') is not null then 'PASS' else 'NOT CONFIGURED' end,
    case when to_regclass('public.weekwise_push_delivery_log') is not null
      then 'Delivery-deduplication table exists'
      else 'Run supabase_push_setup.sql before enabling background reminders'
    end
  union all
  select
    'background push subscription isolation',
    case when
      coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.weekwise_push_subscriptions')), false)
      and not coalesce(has_table_privilege('anon', to_regclass('public.weekwise_push_subscriptions'), 'SELECT'), false)
      and not coalesce(has_table_privilege('authenticated', to_regclass('public.weekwise_push_subscriptions'), 'SELECT'), false)
      and not coalesce(has_table_privilege('anon', to_regclass('public.weekwise_push_subscriptions'), 'INSERT'), false)
      and not coalesce(has_table_privilege('authenticated', to_regclass('public.weekwise_push_subscriptions'), 'INSERT'), false)
      and not coalesce(has_table_privilege('anon', to_regclass('public.weekwise_push_subscriptions'), 'UPDATE'), false)
      and not coalesce(has_table_privilege('authenticated', to_regclass('public.weekwise_push_subscriptions'), 'UPDATE'), false)
      and not coalesce(has_table_privilege('anon', to_regclass('public.weekwise_push_subscriptions'), 'DELETE'), false)
      and not coalesce(has_table_privilege('authenticated', to_regclass('public.weekwise_push_subscriptions'), 'DELETE'), false)
      then 'PASS' else 'NOT CONFIGURED' end,
    'RLS must be enabled and browser roles must not have direct SELECT access'
  union all
  select
    'background push claim RPC',
    case when
      to_regprocedure('public.weekwise_claim_push_delivery(uuid,text,text)') is not null
      and exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'weekwise_claim_push_delivery'
          and has_function_privilege('service_role', p.oid, 'EXECUTE')
          and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
          and not has_function_privilege('anon', p.oid, 'EXECUTE')
      )
      then 'PASS' else 'NOT CONFIGURED' end,
    'Only the service role should execute the atomic push delivery claim'
  union all
  select
    'calendar OAuth state table',
    case when to_regclass('public.weekwise_calendar_oauth_states') is not null then 'PASS' else 'NOT CONFIGURED' end,
    'Run supabase_calendar_setup.sql before connecting Google Calendar or Outlook'
  union all
  select
    'calendar connection table',
    case when to_regclass('public.weekwise_calendar_connections') is not null then 'PASS' else 'NOT CONFIGURED' end,
    'Encrypted provider credentials are stored server-side in this table'
  union all
  select
    'calendar event-link table',
    case when to_regclass('public.weekwise_calendar_event_links') is not null then 'PASS' else 'NOT CONFIGURED' end,
    'Per-event mappings are required to avoid duplicates and detect conflicts'
  union all
  select
    'calendar OAuth state isolation',
    case when
      coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.weekwise_calendar_oauth_states')), false)
      and not coalesce(has_table_privilege('anon', to_regclass('public.weekwise_calendar_oauth_states'), 'SELECT'), false)
      and not coalesce(has_table_privilege('authenticated', to_regclass('public.weekwise_calendar_oauth_states'), 'SELECT'), false)
      then 'PASS' else 'NOT CONFIGURED' end,
    'OAuth state and PKCE verifier data must not be readable by browser roles'
  union all
  select
    'calendar encrypted token isolation',
    case when
      coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.weekwise_calendar_connections')), false)
      and not coalesce(has_table_privilege('anon', to_regclass('public.weekwise_calendar_connections'), 'SELECT'), false)
      and not coalesce(has_table_privilege('authenticated', to_regclass('public.weekwise_calendar_connections'), 'SELECT'), false)
      then 'PASS' else 'NOT CONFIGURED' end,
    'Encrypted access/refresh tokens must be inaccessible to browser roles'
  union all
  select
    'calendar OAuth state consume RPC',
    case when
      to_regprocedure('public.weekwise_consume_calendar_oauth_state(text)') is not null
      and exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'weekwise_consume_calendar_oauth_state'
          and has_function_privilege('service_role', p.oid, 'EXECUTE')
          and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
          and not has_function_privilege('anon', p.oid, 'EXECUTE')
      )
      then 'PASS' else 'NOT CONFIGURED' end,
    'Only the server-side calendar handler should consume one-time OAuth state'
  union all
  select
    'calendar cloud-save RPC',
    case when
      to_regprocedure('public.weekwise_calendar_save_cloud(uuid,jsonb,bigint)') is not null
      and exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'weekwise_calendar_save_cloud'
          and has_function_privilege('service_role', p.oid, 'EXECUTE')
          and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
          and not has_function_privilege('anon', p.oid, 'EXECUTE')
      )
      then 'PASS' else 'NOT CONFIGURED' end,
    'Calendar sync requires a server-only revision-checked cloud-save RPC'
)
select check_name, status, details
from checks
order by case status when 'FAIL' then 0 when 'NOT CONFIGURED' then 1 when 'PRESENT IN ANOTHER SCHEMA' then 2 else 3 end, check_name;

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
        and policyname in ('weekwise_cloud_select_own','weekwise_cloud_insert_own','weekwise_cloud_update_own')
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
)
select check_name, status, details
from checks
order by case status when 'FAIL' then 0 when 'NOT CONFIGURED' then 1 when 'PRESENT IN ANOTHER SCHEMA' then 2 else 3 end, check_name;

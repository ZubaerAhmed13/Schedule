-- Read-only staging/production review. Returns privileges, not planner data.
select
  has_table_privilege('authenticated','public.weekwise_cloud_data','SELECT') as authenticated_can_read,
  has_table_privilege('authenticated','public.weekwise_cloud_data','INSERT') as direct_insert_must_be_false,
  has_table_privilege('authenticated','public.weekwise_cloud_data','UPDATE') as direct_update_must_be_false,
  has_table_privilege('authenticated','public.weekwise_cloud_data','DELETE') as direct_delete_must_be_false,
  has_table_privilege('anon','public.weekwise_cloud_data','SELECT') as anonymous_read_must_be_false,
  has_function_privilege('authenticated','public.weekwise_save(jsonb,bigint)','EXECUTE') as authenticated_can_save,
  has_function_privilege('anon','public.weekwise_save(jsonb,bigint)','EXECUTE') as anonymous_save_must_be_false,
  (select prosecdef from pg_proc where oid='public.weekwise_save(jsonb,bigint)'::regprocedure) as rpc_security_definer,
  (select proconfig from pg_proc where oid='public.weekwise_save(jsonb,bigint)'::regprocedure) as restricted_search_path;

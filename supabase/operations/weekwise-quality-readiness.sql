-- Read-only operator readiness. No planner content, email, credentials, or endpoint selection.
select jsonb_build_object(
 'all_weekwise_public_tables_rls', (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'weekwise_%'),
 'anon_cloud_select', has_table_privilege('anon','public.weekwise_cloud_data','select'),
 'authenticated_cloud_select', has_table_privilege('authenticated','public.weekwise_cloud_data','select'),
 'anon_cloud_write', has_table_privilege('anon','public.weekwise_cloud_data','insert,update,delete'),
 'authenticated_direct_cloud_write', has_table_privilege('authenticated','public.weekwise_cloud_data','insert,update,delete'),
 'anon_save_execute', has_function_privilege('anon','public.weekwise_save(jsonb,bigint)','execute'),
 'authenticated_save_execute', has_function_privilege('authenticated','public.weekwise_save(jsonb,bigint)','execute'),
 'active_push_schedulers', (select count(*) from cron.job where jobname='weekwise-push-dispatch' and active),
 'recent_scheduler_success', (select count(*) from cron.job_run_details d join cron.job j using(jobid) where j.jobname='weekwise-push-dispatch' and d.start_time>now()-interval '30 minutes' and d.status='succeeded'),
 'recent_scheduler_failures', (select count(*) from cron.job_run_details d join cron.job j using(jobid) where j.jobname='weekwise-push-dispatch' and d.start_time>now()-interval '30 minutes' and d.status='failed')
) as checks;

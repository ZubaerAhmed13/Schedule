-- OPTIONAL REVIEWED MIGRATION. Do not run against production without approval.
-- Apply in staging after weekwise_supabase_setup.sql. No user rows are deleted.
-- Existing clients already use this RPC. Authenticated direct table writes are revoked.
begin;
create or replace function public.weekwise_save(p_data jsonb,p_expected_revision bigint)
returns table(saved boolean,revision bigint,data jsonb,updated_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  owner_id uuid := auth.uid();
  current_row public.weekwise_cloud_data%rowtype;
begin
  if owner_id is null then
    raise exception 'You must be signed in to save Weekwise data.' using errcode='28000';
  end if;
  if p_data is null or jsonb_typeof(p_data) is distinct from 'object'
     or jsonb_typeof(p_data->'store') is distinct from 'object'
     or jsonb_typeof(p_data->'store'->'settings') is distinct from 'object'
     or jsonb_typeof(p_data->'store'->'weeks') is distinct from 'object'
     or octet_length(p_data::text)>10485760
     or coalesce(p_expected_revision,0)<0 then
    raise exception 'Invalid Weekwise planner payload.' using errcode='22023';
  end if;
  insert into public.weekwise_cloud_data(user_id,data,revision,updated_at)
  values(owner_id,'{}'::jsonb,0,now()) on conflict(user_id) do nothing;
  select cloud.* into current_row from public.weekwise_cloud_data as cloud
  where cloud.user_id=owner_id for update;
  if not found then raise exception 'Weekwise cloud row could not be initialized.';end if;
  if current_row.revision<>coalesce(p_expected_revision,0) then
    return query select false,current_row.revision,current_row.data,current_row.updated_at;return;
  end if;
  return query update public.weekwise_cloud_data as cloud
  set data=p_data,revision=cloud.revision+1,updated_at=now()
  where cloud.user_id=owner_id and cloud.revision=current_row.revision
  returning true,cloud.revision,cloud.data,cloud.updated_at;
end;
$function$;
revoke insert,update,delete,truncate,references,trigger on table public.weekwise_cloud_data from authenticated;
revoke all on table public.weekwise_cloud_data from public,anon;
grant select on table public.weekwise_cloud_data to authenticated;
revoke all on function public.weekwise_save(jsonb,bigint) from public,anon;
grant execute on function public.weekwise_save(jsonb,bigint) to authenticated;
commit;

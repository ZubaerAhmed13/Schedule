-- Approved by the user and applied only to Weekwise iajkzlsurghfvsmqkmut.
-- Supabase migration: 20261013132923 / weekwise_save_validated_payload_preserve_rpc_contract.
-- This archival operation stops if the pre-review function fingerprint no longer matches.
-- OPTIONAL REVIEWED MIGRATION. Do not run against production without approval.
-- Preserves either known RPC return-column order; never drops the live function.
-- No existing planner records, revision constraints or owner IDs are changed.
begin;
lock table public.weekwise_cloud_data in share row exclusive mode;
do $preflight$
begin
 if pg_catalog.md5(pg_catalog.pg_get_functiondef('public.weekwise_save(jsonb,bigint)'::regprocedure)) <> 'c59799a0d4ca95cbb628b12c78e6bd46' then
  raise exception 'Weekwise save function changed since review; no update applied.';
 end if;
end;
$preflight$;
create temporary table weekwise_approved_rpc_before on commit drop as
 select pg_catalog.count(*) as row_count,
 pg_catalog.md5(coalesce(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(c)::text),'|' order by c.user_id::text),'')) as records_digest
 from public.weekwise_cloud_data c;
do $migration$
declare
  existing_result text := pg_catalog.pg_get_function_result(pg_catalog.to_regprocedure('public.weekwise_save(jsonb,bigint)'));
  result_definition text;
  row_result text;
  empty_result text;
begin
  if existing_result is null or existing_result = 'TABLE(saved boolean, revision bigint, data jsonb, updated_at timestamp with time zone)' then
    result_definition := 'saved boolean, revision bigint, data jsonb, updated_at timestamptz';
    row_result := 'current_row.revision,current_row.data,current_row.updated_at';
    empty_result := '0::bigint,null::jsonb,null::timestamptz';
  elsif existing_result = 'TABLE(saved boolean, revision bigint, updated_at timestamp with time zone, data jsonb)' then
    result_definition := 'saved boolean, revision bigint, updated_at timestamptz, data jsonb';
    row_result := 'current_row.revision,current_row.updated_at,current_row.data';
    empty_result := '0::bigint,null::timestamptz,null::jsonb';
  else
    raise exception 'Unknown Weekwise RPC return contract: %. Review manually; nothing changed.',existing_result;
  end if;
  execute pg_catalog.format($definition$
create or replace function public.weekwise_save(p_data jsonb,p_expected_revision bigint)
returns table(%s)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  owner_id uuid := auth.uid();
  current_row public.weekwise_cloud_data%%rowtype;
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
  -- Serialize first insert as well as updates without inserting a revision-zero placeholder.
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  select cloud.* into current_row from public.weekwise_cloud_data as cloud
  where cloud.user_id=owner_id for update;
  if found then
    if p_expected_revision is null or current_row.revision<>p_expected_revision then
      return query select false,%s;return;
    end if;
    update public.weekwise_cloud_data as cloud
    set data=p_data,revision=cloud.revision+1,updated_at=now()
    where cloud.user_id=owner_id and cloud.revision=current_row.revision
    returning cloud.* into current_row;
  else
    if coalesce(p_expected_revision,0)<>0 then
      return query select false,%s;return;
    end if;
    insert into public.weekwise_cloud_data(user_id,data,revision,updated_at)
    values(owner_id,p_data,1,now()) returning * into current_row;
  end if;
  return query select true,%s;
end;
$function$;
$definition$,result_definition,row_result,empty_result,row_result);
end;
$migration$;
revoke insert,update,delete,truncate,references,trigger on table public.weekwise_cloud_data from authenticated;
revoke all on table public.weekwise_cloud_data from public,anon;
grant select on table public.weekwise_cloud_data to authenticated;
revoke all on function public.weekwise_save(jsonb,bigint) from public,anon;
grant execute on function public.weekwise_save(jsonb,bigint) to authenticated;
do $preservation$
declare after_count bigint; after_digest text;
begin
 select pg_catalog.count(*),
 pg_catalog.md5(coalesce(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(c)::text),'|' order by c.user_id::text),''))
 into after_count,after_digest from public.weekwise_cloud_data c;
 if not exists(select 1 from pg_temp.weekwise_approved_rpc_before where row_count=after_count and records_digest=after_digest) then
  raise exception 'Stored Weekwise rows changed; rolling back the function update.';
 end if;
end;
$preservation$;
commit;

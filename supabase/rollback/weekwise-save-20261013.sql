-- Captured from the correct Weekwise project on 2026-10-13 before any mutation.
-- Restore only after reviewing intervening changes; no planner rows are changed.
-- Original catalog fingerprint: c59799a0d4ca95cbb628b12c78e6bd46.
CREATE OR REPLACE FUNCTION public.weekwise_save(p_data jsonb, p_expected_revision bigint)
 RETURNS TABLE(saved boolean, revision bigint, updated_at timestamp with time zone, data jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid;
  v_row public.weekwise_cloud_data%rowtype;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Sign in is required to save Weekwise data.' using errcode = '28000';
  end if;

  if p_data is null or pg_catalog.jsonb_typeof(p_data) <> 'object' then
    raise exception 'Weekwise data must be a JSON object.' using errcode = '22023';
  end if;

  -- Serializes first writes and updates for this user to avoid first-insert races.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

  select c.*
    into v_row
    from public.weekwise_cloud_data as c
   where c.user_id = v_user_id
   for update;

  if found then
    if p_expected_revision is null or p_expected_revision <> v_row.revision then
      return query select false, v_row.revision, v_row.updated_at, v_row.data;
      return;
    end if;

    update public.weekwise_cloud_data as c
       set data = p_data,
           revision = c.revision + 1,
           updated_at = pg_catalog.now()
     where c.user_id = v_user_id
     returning c.* into v_row;

    return query select true, v_row.revision, v_row.updated_at, v_row.data;
    return;
  end if;

  if coalesce(p_expected_revision, 0) <> 0 then
    return query select false, 0::bigint, null::timestamptz, null::jsonb;
    return;
  end if;

  insert into public.weekwise_cloud_data (user_id, data, revision, updated_at)
  values (v_user_id, p_data, 1, pg_catalog.now())
  returning * into v_row;

  return query select true, v_row.revision, v_row.updated_at, v_row.data;
end;
$function$
;

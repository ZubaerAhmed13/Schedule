-- Weekwise cloud sync schema and optimistic-revision save function
-- Run this file once in Supabase Dashboard -> SQL Editor.
-- Then run supabase_invite_code_setup.sql to enable invite-only sign-up.
-- Uses the signed-in user's auth.uid() and RLS; never put a service-role key in the app.

create table if not exists public.weekwise_cloud_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.weekwise_cloud_data enable row level security;

drop policy if exists weekwise_cloud_select_own on public.weekwise_cloud_data;
create policy weekwise_cloud_select_own
  on public.weekwise_cloud_data
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists weekwise_cloud_insert_own on public.weekwise_cloud_data;
create policy weekwise_cloud_insert_own
  on public.weekwise_cloud_data
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists weekwise_cloud_update_own on public.weekwise_cloud_data;
create policy weekwise_cloud_update_own
  on public.weekwise_cloud_data
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.weekwise_cloud_data to authenticated;
revoke all on public.weekwise_cloud_data from anon;

create or replace function public.weekwise_save(
  p_data jsonb,
  p_expected_revision bigint
)
returns table (
  saved boolean,
  revision bigint,
  data jsonb,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $function$
declare
  current_row public.weekwise_cloud_data%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to save Weekwise data.'
      using errcode = '28000';
  end if;

  insert into public.weekwise_cloud_data (user_id, data, revision, updated_at)
  values (auth.uid(), '{}'::jsonb, 0, now())
  on conflict (user_id) do nothing;

  select *
    into current_row
    from public.weekwise_cloud_data
   where user_id = auth.uid()
   for update;

  if not found then
    raise exception 'Weekwise cloud row could not be initialized.';
  end if;

  if current_row.revision <> coalesce(p_expected_revision, 0) then
    return query
      select false, current_row.revision, current_row.data, current_row.updated_at;
    return;
  end if;

  return query
    update public.weekwise_cloud_data as cloud_row
       set data = p_data,
           revision = cloud_row.revision + 1,
           updated_at = now()
     where cloud_row.user_id = auth.uid()
       and cloud_row.revision = current_row.revision
    returning true, cloud_row.revision, cloud_row.data, cloud_row.updated_at;
end;
$function$;

revoke all on function public.weekwise_save(jsonb, bigint) from public, anon;
grant execute on function public.weekwise_save(jsonb, bigint) to authenticated;

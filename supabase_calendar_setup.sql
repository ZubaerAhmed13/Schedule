-- Weekwise Google Calendar / Microsoft Outlook OAuth and event-sync schema.
-- Run in Supabase SQL Editor before deploying weekwise-calendar.
-- All token and OAuth state records are server-side only. Never put provider secrets in the static app.

create table if not exists public.weekwise_calendar_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  code_verifier text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists weekwise_calendar_oauth_states_expiry_idx
  on public.weekwise_calendar_oauth_states (expires_at);

create table if not exists public.weekwise_calendar_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  encrypted_access_token text not null,
  encrypted_refresh_token text not null,
  access_token_expires_at timestamptz not null,
  granted_scope text not null default '',
  provider_account_email text,
  provider_calendar_timezone text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create table if not exists public.weekwise_calendar_event_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  task_id text not null,
  provider_event_id text not null,
  weekwise_fingerprint text not null,
  provider_updated_at timestamptz,
  provider_event_start_at timestamptz,
  synced_at timestamptz not null default now(),
  primary key (user_id, provider, task_id),
  unique (user_id, provider, provider_event_id)
);

create index if not exists weekwise_calendar_event_links_window_idx
  on public.weekwise_calendar_event_links (user_id, provider, provider_event_start_at);

alter table public.weekwise_calendar_oauth_states enable row level security;
alter table public.weekwise_calendar_connections enable row level security;
alter table public.weekwise_calendar_event_links enable row level security;

revoke all on table public.weekwise_calendar_oauth_states from public, anon, authenticated;
revoke all on table public.weekwise_calendar_connections from public, anon, authenticated;
revoke all on table public.weekwise_calendar_event_links from public, anon, authenticated;
grant all on table public.weekwise_calendar_oauth_states to service_role;
grant all on table public.weekwise_calendar_connections to service_role;
grant all on table public.weekwise_calendar_event_links to service_role;

create or replace function public.weekwise_consume_calendar_oauth_state(p_state_hash text)
returns table (user_id uuid, provider text, code_verifier text)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the trusted Weekwise calendar handler may consume OAuth state.'
      using errcode = '42501';
  end if;

  return query
    delete from public.weekwise_calendar_oauth_states s
    where s.state_hash = p_state_hash
      and s.expires_at > now()
    returning s.user_id, s.provider, s.code_verifier;
end;
$function$;

revoke all on function public.weekwise_consume_calendar_oauth_state(text) from public, anon, authenticated;
grant execute on function public.weekwise_consume_calendar_oauth_state(text) to service_role;

-- The Edge Function must update the synced cloud snapshot atomically at the expected revision.
-- A conflict returns the latest snapshot and never overwrites concurrent edits silently.
create or replace function public.weekwise_calendar_save_cloud(
  p_user_id uuid,
  p_data jsonb,
  p_expected_revision bigint
)
returns table (saved boolean, revision bigint, data jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  current_row public.weekwise_cloud_data%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the trusted Weekwise calendar handler may update cloud snapshots.'
      using errcode = '42501';
  end if;

  select * into current_row
    from public.weekwise_cloud_data
   where user_id = p_user_id
   for update;

  if not found then
    raise exception 'Weekwise cloud data is not initialized. Sign in and sync before calendar synchronization.';
  end if;

  if current_row.revision <> coalesce(p_expected_revision, -1) then
    return query select false, current_row.revision, current_row.data, current_row.updated_at;
    return;
  end if;

  return query
    update public.weekwise_cloud_data as cloud_row
       set data = p_data,
           revision = cloud_row.revision + 1,
           updated_at = now()
     where cloud_row.user_id = p_user_id
       and cloud_row.revision = current_row.revision
    returning true, cloud_row.revision, cloud_row.data, cloud_row.updated_at;
end;
$function$;

revoke all on function public.weekwise_calendar_save_cloud(uuid, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.weekwise_calendar_save_cloud(uuid, jsonb, bigint) to service_role;


-- Isolated disposable CI database only. Never execute this fixture in Supabase.
\set ON_ERROR_STOP on
create role authenticated;
create role anon;
create schema auth;
create table auth.users(id uuid primary key);
insert into auth.users values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create table public.weekwise_cloud_data(user_id uuid primary key references auth.users(id) on delete cascade,data jsonb not null,revision bigint not null check(revision>=1),updated_at timestamptz not null default now());
alter table public.weekwise_cloud_data enable row level security;
create policy "Read own Weekwise cloud data" on public.weekwise_cloud_data for select to authenticated using ((select auth.uid())=user_id);
-- Exact live return order; replacement must not require DROP FUNCTION.
create function public.weekwise_save(p_data jsonb,p_expected_revision bigint) returns table(saved boolean,revision bigint,updated_at timestamptz,data jsonb) language sql as $$ select false,0::bigint,null::timestamptz,null::jsonb $$;
\ir ../../weekwise_rpc_hardening.sql
\ir weekwise-rpc-behavior.sql
-- Reapplying retains the known contract and all rows/revisions.
\ir ../../weekwise_rpc_hardening.sql
-- Second isolated contract: legacy return order and revision-zero-permitted schema.
drop function public.weekwise_save(jsonb,bigint);
truncate public.weekwise_cloud_data;
alter table public.weekwise_cloud_data drop constraint weekwise_cloud_data_revision_check;
alter table public.weekwise_cloud_data add check(revision>=0);
create function public.weekwise_save(p_data jsonb,p_expected_revision bigint) returns table(saved boolean,revision bigint,data jsonb,updated_at timestamptz) language sql as $$ select false,0::bigint,null::jsonb,null::timestamptz $$;
\ir ../../weekwise_rpc_hardening.sql
\ir weekwise-rpc-behavior.sql
select 'Both RPC output contracts and revision constraints passed' as result;

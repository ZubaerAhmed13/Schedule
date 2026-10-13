-- Cover the owner FK for account cascade and per-user cleanup. No rows are changed.
create index if not exists weekwise_calendar_oauth_states_user_id_idx on public.weekwise_calendar_oauth_states (user_id);

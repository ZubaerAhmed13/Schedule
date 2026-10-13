-- Isolated CI only; follows the core/runtime fixtures in the same database.
alter table auth.users add column raw_user_meta_data jsonb not null default '{}';
create temporary table invite_existing_users as select * from auth.users;
\ir ../../supabase/migrations/20261013174356_weekwise_invitation_enforcement.sql
create temporary table invite_before as select code_hash,is_active,use_count from private.weekwise_invite_codes;
\ir ../../supabase/migrations/20261013174356_weekwise_invitation_enforcement.sql
do $test$ declare group_data jsonb;code text;id uuid;begin
 assert not exists(select * from invite_existing_users except select * from auth.users),'existing users unchanged';
 assert (select count(*) from private.weekwise_invite_codes)=2,'reapply never rotates invitations';
 assert not exists(select * from invite_before except select code_hash,is_active,use_count from private.weekwise_invite_codes),'reapply preserves revocation and uses';
 perform set_config('request.jwt.claim.role','service_role',true);
 group_data=public.weekwise_prepare_backend_check_invites();
 foreach code in array array['','wrong',group_data->>'revoked',group_data->>'expired',repeat('x',65)] loop
  begin
   insert into auth.users(id,raw_user_meta_data) values(extensions.gen_random_uuid(),jsonb_build_object('weekwise_referral_code',code));
   raise exception 'Rejected invitation inserted account' using errcode='XX000';
  exception when raise_exception then null;end;
 end loop;
 for i in 1..2 loop
  insert into auth.users(id,raw_user_meta_data) values(extensions.gen_random_uuid(),jsonb_build_object('weekwise_referral_code',lower(group_data->>'valid')));
 end loop;
 begin
  insert into auth.users(id,raw_user_meta_data) values(extensions.gen_random_uuid(),jsonb_build_object('weekwise_referral_code',group_data->>'valid'));
  raise exception 'Exhausted invitation inserted account' using errcode='XX000';
 exception when raise_exception then null;end;
 assert (select use_count from private.weekwise_invite_codes where check_id=(group_data->>'check_id')::uuid and max_uses=2)=2,'atomic maximum enforced';
 assert public.weekwise_cleanup_backend_check_invites((group_data->>'check_id')::uuid),'own check cleanup';
 assert (select count(*) from private.weekwise_invite_codes)=2,'owner invites survive check cleanup';
end;$test$;
set role authenticated;
do $test$ begin
 begin perform * from private.weekwise_invite_codes;raise exception 'Browser read invitations' using errcode='XX000';exception when insufficient_privilege then null;end;
 begin perform public.weekwise_prepare_backend_check_invites();raise exception 'Browser obtained invitation' using errcode='XX000';exception when insufficient_privilege then null;end;
end;$test$;
reset role;
\ir ../../supabase/migrations/20261013174707_weekwise_push_owner_registration.sql
do $test$ declare a uuid;b uuid;fixture_endpoint text='https://fcm.googleapis.com/fcm/send/isolated-test';begin
 select id into a from auth.users order by id limit 1;select id into b from auth.users where id<>a order by id limit 1;
 perform set_config('request.jwt.claim.role','service_role',true);
 assert public.weekwise_register_push_subscription(a,fixture_endpoint,jsonb_build_object('endpoint',fixture_endpoint),'UTC','fixture'),'first owner';
 assert public.weekwise_register_push_subscription(a,fixture_endpoint,jsonb_build_object('endpoint',fixture_endpoint),'Europe/Berlin','fixture'),'same owner update';
 assert not public.weekwise_register_push_subscription(b,fixture_endpoint,jsonb_build_object('endpoint',fixture_endpoint),'UTC','fixture'),'other owner cannot transfer endpoint';
 assert (select user_id=a and timezone='Europe/Berlin' from public.weekwise_push_subscriptions where endpoint=fixture_endpoint),'owner and settings unchanged';
end;$test$;
set role authenticated;
do $test$ begin
 begin perform public.weekwise_register_push_subscription(null,null,null,null,null);raise exception 'Browser registered push' using errcode='XX000';exception when insufficient_privilege then null;end;
end;$test$;
reset role;
select 'Invitation limits, revocation, expiry, private access and preservation passed' as result;
-- Exact operator transaction must also reapply without touching any old rows.
\ir ../../supabase/operations/weekwise-invitation-approved-update.sql

set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
do $test$
declare r record; n integer;
begin
 select * into r from public.weekwise_save('{"store":{"settings":{},"weeks":{}}}'::jsonb,0);
 assert r.saved and r.revision=1,'first save must begin at revision one';
 select * into r from public.weekwise_save('{"store":{"settings":{},"weeks":{}}}'::jsonb,1);
 assert r.saved and r.revision=2,'matching revision must advance exactly once';
 select * into r from public.weekwise_save('{"store":{"settings":{},"weeks":{}}}'::jsonb,1);
 assert not r.saved and r.revision=2,'stale save must return conflict';
 begin
  perform public.weekwise_save('{}'::jsonb,2);
  raise exception 'Malformed payload accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.weekwise_save(jsonb_build_object('store',jsonb_build_object('settings','{}'::jsonb,'weeks','{}'::jsonb),'padding',repeat('x',10485761)),2);
  raise exception 'Oversized payload accepted';
 exception when invalid_parameter_value then null; end;
 begin
  update public.weekwise_cloud_data set revision=99;
  raise exception 'Direct write was allowed';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
 select count(*) into n from public.weekwise_cloud_data;assert n=0,'second user must not read the first user row';
 select * into r from public.weekwise_save('{"store":{"settings":{},"weeks":{}}}'::jsonb,99);
 assert not r.saved and r.revision=0 and r.data is null,'missing-row stale save must not insert';
 select * into r from public.weekwise_save('{"store":{"settings":{},"weeks":{}}}'::jsonb,0);
 assert r.saved and r.revision=1,'second user must save only their own row';
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.weekwise_save('{"store":{"settings":{},"weeks":{}}}'::jsonb,0);
  raise exception 'Missing identity accepted';
 exception when invalid_authorization_specification then null; end;
end;
$test$;
reset role;
set role anon;
do $test$
begin
 begin
  perform public.weekwise_save('{"store":{"settings":{},"weeks":{}}}'::jsonb,0);
  raise exception 'Anonymous save was allowed';
 exception when insufficient_privilege then null; end;
end;
$test$;
reset role;
do $test$
begin
 assert (select count(*) from public.weekwise_cloud_data)=2,'exactly two synthetic owned rows';
 assert (select revision from public.weekwise_cloud_data where user_id='00000000-0000-4000-8000-000000000001')=2,'first user untouched by second user';
end;
$test$;

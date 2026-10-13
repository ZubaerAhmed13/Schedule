-- Prevent one authenticated browser from moving a known push endpoint to its
-- account. The service passes its verified owner; conflict ownership is atomic.
create or replace function public.weekwise_register_push_subscription(
 p_owner uuid,p_endpoint text,p_subscription jsonb,p_timezone text,p_user_agent text
) returns boolean language plpgsql security definer set search_path=pg_catalog as $function$
declare inserted text;begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 if p_owner is null or p_endpoint is null or p_endpoint not like 'https://%' or length(p_endpoint)>4096
 or jsonb_typeof(p_subscription) is distinct from 'object' or p_subscription->>'endpoint' is distinct from p_endpoint
 or p_timezone is null or length(p_timezone)>100 then raise invalid_parameter_value;end if;
 insert into public.weekwise_push_subscriptions(endpoint,user_id,subscription,timezone,user_agent,updated_at)
 values(p_endpoint,p_owner,p_subscription,p_timezone,left(p_user_agent,300),now())
 on conflict(endpoint) do update set subscription=excluded.subscription,timezone=excluded.timezone,
 user_agent=excluded.user_agent,updated_at=excluded.updated_at
 where public.weekwise_push_subscriptions.user_id=excluded.user_id
 returning endpoint into inserted;
 return inserted is not null;
end;$function$;
revoke all on function public.weekwise_register_push_subscription(uuid,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.weekwise_register_push_subscription(uuid,text,jsonb,text,text) to service_role;

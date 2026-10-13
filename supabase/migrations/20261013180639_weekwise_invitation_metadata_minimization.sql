-- Minimize newly submitted invitation metadata; preserve every existing user.
create or replace function private.weekwise_require_referral_code()
returns trigger language plpgsql security definer set search_path=pg_catalog as $function$
declare submitted text;begin
 submitted=upper(btrim(coalesce(new.raw_user_meta_data->>'weekwise_referral_code','')));
 if length(submitted)<1 or length(submitted)>64 then
  raise exception 'A valid Weekwise invitation is required.' using errcode='P0001';
 end if;
 -- The submitted code is untrusted input, never a role/owner claim. The private
 -- hash and one atomic conditional UPDATE decide whether signup is permitted.
 update private.weekwise_invite_codes set use_count=use_count+1
 where code_hash=encode(extensions.digest(submitted,'sha256'),'hex') and is_active
 and (expires_at is null or expires_at>now()) and (max_uses is null or use_count<max_uses);
 if not found then raise exception 'A valid Weekwise invitation is required.' using errcode='P0001';end if;
 -- Discard the untrusted submitted invitation after successful verification.
 -- Existing accounts/metadata are untouched. It must not enter new JWTs.
 new.raw_user_meta_data=new.raw_user_meta_data-'weekwise_referral_code';
 return new;
end;$function$;
revoke all on function private.weekwise_require_referral_code() from public,anon,authenticated;

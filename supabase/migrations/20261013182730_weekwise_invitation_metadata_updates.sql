-- Auth may write submitted signup metadata again after the initial insert.
-- Strip only a newly introduced invitation field from future metadata updates;
-- migration execution never changes existing users or historical metadata.
create or replace function private.weekwise_minimize_new_invitation_metadata()
returns trigger language plpgsql set search_path=pg_catalog as $function$
begin
 new.raw_user_meta_data=new.raw_user_meta_data-'weekwise_referral_code';
 return new;
end;$function$;
revoke all on function private.weekwise_minimize_new_invitation_metadata() from public,anon,authenticated;
drop trigger if exists weekwise_minimize_new_invitation_metadata on auth.users;
create trigger weekwise_minimize_new_invitation_metadata
 before update of raw_user_meta_data on auth.users for each row
 when (new.raw_user_meta_data ? 'weekwise_referral_code' and not (old.raw_user_meta_data ? 'weekwise_referral_code'))
 execute function private.weekwise_minimize_new_invitation_metadata();

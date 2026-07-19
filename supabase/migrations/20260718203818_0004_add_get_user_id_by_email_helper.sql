/*
# Add get_user_id_by_email helper for the invite-member edge function

## Purpose
The invite flow needs to look up an existing auth user by email to attach a
tenant_members row to their real user id. The PostgREST layer cannot expose
auth.users directly, so a SECURITY DEFINER SQL function provides a safe,
narrow lookup that the edge function calls via .rpc().

## Security
- SECURITY DEFINER so it can read auth.users (the caller cannot).
- Returns only the uuid id, nothing else.
- Marked STABLE.
*/

create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  out_id uuid;
begin
  select id into out_id from auth.users where email = p_email limit 1;
  return out_id;
end;
$$;
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Mind to Mouth keeps talks on the phone, so the only server-side data is the
-- account itself. App Store guideline 5.1.1(v) requires in-app account
-- deletion, and supabase-js cannot delete a user from the client, so this
-- function does it on the user's behalf. SECURITY DEFINER lets it touch
-- auth.users; auth.uid() limits it to the caller's own row. Deleting the row
-- cascades to identities, sessions and refresh tokens.

create or replace function public.delete_user()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke execute on function public.delete_user() from public, anon;
grant execute on function public.delete_user() to authenticated;

-- A name the organizer chooses for themselves, edited on /dashboard/profile.
-- Until now a profile was only the email address copied from auth.users.
-- The existing "profiles_update_own" policy (0001) already lets an organizer
-- update their own row, so no policy changes are needed.
alter table public.profiles
  add column if not exists display_name text
  check (display_name is null or length(display_name) <= 60);

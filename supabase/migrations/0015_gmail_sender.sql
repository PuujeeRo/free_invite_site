-- An organizer may connect their own Gmail account so invitation emails are
-- sent from their address instead of the site's (src/lib/email/gmail.ts).
--
-- The refresh token is what lets the server send on their behalf later, so it
-- is stored encrypted (AES-256-GCM, key held only in the server's environment)
-- and this table has no policies at all: it is read and written only with the
-- service-role key, never through an organizer's own session. A leaked
-- database dump therefore does not hand over anyone's mailbox.
create table if not exists public.gmail_connections (
  organizer_id uuid primary key references public.profiles (id) on delete cascade,
  email text not null,
  refresh_token_enc text not null,
  connected_at timestamptz not null default now()
);

alter table public.gmail_connections enable row level security;

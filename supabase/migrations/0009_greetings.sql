-- A second kind of thing an organizer can send: a greeting card
-- ("мэндчилгээ") addressed to someone, as opposed to an invitation that asks
-- guests to RSVP.
--
-- Stored on the same table because a greeting is the same object in every way
-- that matters here -- a slug, a template, a cover, an owner, an expiry -- and
-- differs only in how the card words itself and in having no RSVP box.
--   kind         which of the two this row is. Existing rows are invitations.
--   sender_name  the "from" line of a greeting; unused for invitations.
-- For a greeting, events.name holds the recipient ("to") and
-- events.description holds the message.
create type event_kind as enum ('invitation', 'greeting');

alter table public.events
  add column kind event_kind not null default 'invitation',
  add column sender_name text;

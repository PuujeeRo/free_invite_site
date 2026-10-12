-- Where the cover image sits on the card: above the text (the only layout
-- until now, hence the default), below it, or behind it as the full card
-- background. Mirrors CoverLayout in src/lib/supabase/types.ts.
--
-- A checked text column rather than an enum: this is a presentation choice
-- that is likely to gain values, and enum values can never be removed.
alter table public.events
  add column cover_layout text not null default 'top'
  check (cover_layout in ('top', 'bottom', 'full'));

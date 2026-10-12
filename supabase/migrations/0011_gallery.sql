-- Extra slider images for an invitation, as external https links.
--
-- Only the main cover (events.photo_url) is ever uploaded to storage; these
-- are addresses of images hosted elsewhere, shown after the cover as a
-- swipeable slider and cropped to shape on the way through /api/img.
--
-- The cap of 8 matches MAX_GALLERY_IMAGES in src/lib/gallery.ts; it is repeated
-- here so a write that bypasses the app still cannot attach an unbounded list.
alter table public.events
  add column gallery_urls text[] not null default '{}'
  check (cardinality(gallery_urls) <= 8);

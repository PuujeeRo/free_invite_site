"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { candidateSlug } from "@/lib/slug";
import { uploadEventPhoto } from "@/lib/storage";
import { validateCoverFile } from "@/lib/cover-media";
import { normalizeMapInput } from "@/lib/map-embed";
import { parseGalleryUrls } from "@/lib/gallery";
import { buildTheme, parseCardEffect, parseCoverBackground, parseCoverIcon } from "@/lib/theme";
import { FREE_PLAN_ACTIVE_DAYS, featuresUnlocked, parseLifetimeDays } from "@/lib/event-types";
import { TEMPLATES } from "@/lib/templates";
import { EVENT_TYPES } from "@/lib/event-types";
import { parseCoverLayout, type EventType } from "@/lib/supabase/types";

export type CreateEventError =
  | "choose_type"
  | "enter_name"
  | "choose_date"
  | "choose_template"
  | "photo_type"
  | "photo_size"
  | "bad_map_link"
  | "bad_gallery"
  | "live_limit"
  | "generic"
  | "slug";

export interface CreateEventState {
  error?: CreateEventError;
}

const EVENT_TYPE_IDS = new Set(EVENT_TYPES.map((t) => t.id));
const TEMPLATE_IDS = new Set(TEMPLATES.map((t) => t.id));

const POSTGRES_UNIQUE_VIOLATION = "23505";
// Raised by guard_event_insert (migration 0014) at MAX_LIVE_INVITATIONS.
const LIVE_LIMIT_ERRCODE = "P0003";
const MAX_SLUG_ATTEMPTS = 5;

export async function createEvent(
  _prevState: CreateEventState,
  formData: FormData
): Promise<CreateEventState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/create");
  }

  const eventType = String(formData.get("event_type") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "");
  const eventTime = String(formData.get("event_time") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const templateId = String(formData.get("template_id") ?? "classic");
  const photo = formData.get("photo");
  const isGreeting = formData.get("kind") === "greeting";
  const senderName = String(formData.get("sender_name") ?? "").trim().slice(0, 80);
  const coverLayout = parseCoverLayout(formData.get("cover_layout"));

  if (!EVENT_TYPE_IDS.has(eventType as EventType)) {
    return { error: "choose_type" };
  }
  if (!name) {
    return { error: "enter_name" };
  }
  if (!eventDate) {
    return { error: "choose_date" };
  }
  if (!TEMPLATE_IDS.has(templateId)) {
    return { error: "choose_template" };
  }

  // A greeting has no place, so no map. For an invitation the link is checked
  // before anything is created: it becomes an href on a public page. A new
  // event is never paid yet, hence featuresUnlocked(false).
  const mapLink =
    isGreeting || !featuresUnlocked(false)
      ? ({ ok: true, url: null } as const)
      : await normalizeMapInput(formData.get("map_link"));
  if (!mapLink.ok) {
    return { error: "bad_map_link" };
  }

  const lifetimeDays = parseLifetimeDays(formData.get("lifetime_days"));
  const theme = buildTheme({
    effect: parseCardEffect(formData.get("effect")),
    cover: parseCoverBackground(formData.get("cover_background")),
    icon: parseCoverIcon(formData.get("cover_icon")),
  });
  const gallery = parseGalleryUrls(formData.get("gallery_urls"));
  if (!gallery.ok) {
    return { error: "bad_gallery" };
  }

  // Validated up front, before the event row is inserted. Doing it after the
  // insert (where the upload has to happen, since the path needs the event id)
  // would mean a rejected file leaves behind an event the organizer never got
  // to see -- they'd land on an error with a phantom invitation already created.
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto) {
    const rejection = await validateCoverFile(photo);
    if (rejection) {
      return { error: rejection === "type" ? "photo_type" : "photo_size" };
    }
  }

  let insertedId: string | null = null;
  let insertedSlug: string | null = null;

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = candidateSlug(name, attempt < 2 ? 4 : 6);
    const { data, error } = await supabase
      .from("events")
      .insert({
        organizer_id: user.id,
        event_type: eventType as EventType,
        name,
        event_date: eventDate,
        // A greeting is a card, not a gathering: it has no time or place.
        event_time: isGreeting ? null : eventTime || null,
        location: isGreeting ? null : location || null,
        description: description || null,
        ...(mapLink.url ? { map_link: mapLink.url } : {}),
        template_id: templateId,
        slug,
        // Sent only for greetings, so that creating an ordinary invitation
        // keeps working on a database that has not had migration 0009 applied
        // (the columns would not exist yet; their default is 'invitation').
        ...(isGreeting ? { kind: "greeting" as const, sender_name: senderName || null } : {}),
        // Same reasoning, migration 0010: the default placement is not sent,
        // so it never touches a column that may not exist yet.
        ...(coverLayout !== "top" ? { cover_layout: coverLayout } : {}),
        // Migration 0011, same rule: only sent when there is something to store.
        ...(gallery.urls.length > 0 ? { gallery_urls: gallery.urls } : {}),
        // The column's own default is the 7-day lifetime, so only a longer
        // choice is written.
        ...(lifetimeDays !== FREE_PLAN_ACTIVE_DAYS
          ? { expires_at: new Date(Date.now() + lifetimeDays * 24 * 60 * 60 * 1000).toISOString() }
          : {}),
        // events.theme has existed since the first migration, so this needs no
        // such care -- it is simply left at its default unless an effect other
        // than the standard one was chosen.
        ...(featuresUnlocked(false) && Object.keys(theme).length > 0 ? { theme } : {}),
      })
      .select("id, slug")
      .single();

    if (!error && data) {
      insertedId = data.id;
      insertedSlug = data.slug;
      break;
    }

    if (error && (error as { code?: string }).code === LIVE_LIMIT_ERRCODE) {
      return { error: "live_limit" };
    }

    // Only retry on a slug collision; anything else is a real failure.
    if (error && (error as { code?: string }).code !== POSTGRES_UNIQUE_VIOLATION) {
      return { error: "generic" };
    }
  }

  if (!insertedId || !insertedSlug) {
    return { error: "slug" };
  }

  if (hasPhoto) {
    try {
      const photoUrl = await uploadEventPhoto(supabase, user.id, insertedId, photo);
      await supabase.from("events").update({ photo_url: photoUrl }).eq("id", insertedId);
    } catch {
      // Reaching here means the file already passed validation and the event
      // row exists, so this is an infrastructure failure rather than bad input.
      // The cover can be added from the edit page, so don't discard the event.
    }
  }

  redirect(`/dashboard/${insertedId}`);
}

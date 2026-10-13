"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uploadEventPhoto } from "@/lib/storage";
import { validateCoverFile } from "@/lib/cover-media";
import { isGreeting } from "@/lib/greeting";
import { parseHttpLink } from "@/lib/safe-link";
import { normalizeMapInput } from "@/lib/map-embed";
import { parseGalleryUrls, readGallery } from "@/lib/gallery";
import { buildTheme, parseCardEffect, parseCoverBackground, parseCoverIcon } from "@/lib/theme";
import { TEMPLATES } from "@/lib/templates";
import { parseCoverLayout, type EventRow } from "@/lib/supabase/types";

export type EditEventError =
  | "not_found"
  | "enter_name"
  | "choose_date"
  | "choose_template"
  | "photo_type"
  | "photo_size"
  | "bad_map_link"
  | "bad_gallery"
  | "bad_video_link"
  | "generic";

export interface EditEventState {
  error?: EditEventError;
  saved?: boolean;
}

const TEMPLATE_IDS = new Set(TEMPLATES.map((t) => t.id));
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function updateEvent(_prevState: EditEventState, formData: FormData): Promise<EditEventState> {
  const eventId = String(formData.get("event_id") ?? "");
  const supabase = await createClient();

  // RLS scopes this to the caller's own event.
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle<EventRow>();

  if (!event) {
    return { error: "not_found" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "");
  const eventTime = String(formData.get("event_time") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const templateId = String(formData.get("template_id") ?? event.template_id);
  const photo = formData.get("photo");

  if (!name) return { error: "enter_name" };
  if (!eventDate) return { error: "choose_date" };
  if (!TEMPLATE_IDS.has(templateId)) return { error: "choose_template" };

  // Both links are validated: they become an href / src on a public page.
  const mapLink = !isGreeting(event) ? await normalizeMapInput(formData.get("map_link")) : null;
  if (mapLink && !mapLink.ok) return { error: "bad_map_link" };
  const videoLink = parseHttpLink(formData.get("video_url"));
  if (!videoLink.ok) return { error: "bad_video_link" };

  const greeting = isGreeting(event);
  const update: Partial<EventRow> = {
    name,
    event_date: eventDate,
    event_time: greeting ? null : eventTime || null,
    location: greeting ? null : location || null,
    description: description || null,
    template_id: templateId,
  };
  if (greeting) {
    update.sender_name = String(formData.get("sender_name") ?? "").trim().slice(0, 80) || null;
  }
  // Written only when it actually changes, so saving an unrelated edit works
  // on a database that has not had migration 0010 applied.
  const coverLayout = parseCoverLayout(formData.get("cover_layout"));
  if (coverLayout !== parseCoverLayout(event.cover_layout)) {
    update.cover_layout = coverLayout;
  }
  // Likewise for the gallery (migration 0011): written only when it changes.
  const gallery = parseGalleryUrls(formData.get("gallery_urls"));
  if (!gallery.ok) return { error: "bad_gallery" };
  if (gallery.urls.join("\n") !== readGallery(event.gallery_urls).join("\n")) {
    update.gallery_urls = gallery.urls;
  }

  if (photo instanceof File && photo.size > 0) {
    // Re-checked here even though the form pre-checks: the client's `accept`
    // filter and File.type are both trivially bypassed, and this bucket is
    // publicly readable (see lib/cover-media.ts).
    const rejection = await validateCoverFile(photo);
    if (rejection) {
      return { error: rejection === "type" ? "photo_type" : "photo_size" };
    }

    try {
      update.photo_url = await uploadEventPhoto(supabase, event.organizer_id, event.id, photo);
    } catch {
      return { error: "generic" };
    }
  } else if (formData.get("remove_photo") === "1" && event.photo_url) {
    // The cover was taken off in the form. Only the reference is cleared; the
    // card then falls back to the chosen built-in background, if any.
    update.photo_url = null;
  }

  // Extras: accent colour, custom greeting, video, map and countdown.
  const accentColor = String(formData.get("accent_color") ?? "").trim();
  const greetingOverride = String(formData.get("greeting_override") ?? "").trim();
  const countdownEnabled = formData.get("countdown_enabled") === "on";

  update.theme = buildTheme({
    accentColor: accentColor && HEX_COLOR.test(accentColor) ? accentColor : null,
    effect: parseCardEffect(formData.get("effect")),
    cover: parseCoverBackground(formData.get("cover_background")),
    icon: parseCoverIcon(formData.get("cover_icon")),
  });
  update.custom_text = greetingOverride ? { greetingOverride } : {};
  if (videoLink.ok) update.video_url = videoLink.url;
  if (mapLink?.ok) update.map_link = mapLink.url;
  update.countdown_enabled = countdownEnabled;

  const { error } = await supabase.from("events").update(update).eq("id", eventId);
  if (error) {
    return { error: "generic" };
  }

  revalidatePath(`/dashboard/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/edit`);
  redirect(`/dashboard/${eventId}`);
}

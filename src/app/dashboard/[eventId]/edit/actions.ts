"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uploadEventPhoto } from "@/lib/storage";
import { validateCoverFile } from "@/lib/cover-media";
import { TEMPLATES } from "@/lib/templates";
import type { EventRow } from "@/lib/supabase/types";

export type EditEventError =
  | "not_found"
  | "enter_name"
  | "choose_date"
  | "choose_template"
  | "photo_type"
  | "photo_size"
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

  const update: Partial<EventRow> = {
    name,
    event_date: eventDate,
    event_time: eventTime || null,
    location: location || null,
    description: description || null,
    template_id: templateId,
  };

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
  }

  // Paid-only fields: silently ignored (not just hidden) for a free event, so
  // a form submitted directly can't bypass the paid gate.
  if (event.is_paid) {
    const accentColor = String(formData.get("accent_color") ?? "").trim();
    const greetingOverride = String(formData.get("greeting_override") ?? "").trim();
    const videoUrl = String(formData.get("video_url") ?? "").trim();
    const mapLink = String(formData.get("map_link") ?? "").trim();
    const countdownEnabled = formData.get("countdown_enabled") === "on";

    update.theme = accentColor && HEX_COLOR.test(accentColor) ? { accentColor } : {};
    update.custom_text = greetingOverride ? { greetingOverride } : {};
    update.video_url = videoUrl || null;
    update.map_link = mapLink || null;
    update.countdown_enabled = countdownEnabled;
  }

  const { error } = await supabase.from("events").update(update).eq("id", eventId);
  if (error) {
    return { error: "generic" };
  }

  revalidatePath(`/dashboard/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/edit`);
  redirect(`/dashboard/${eventId}`);
}

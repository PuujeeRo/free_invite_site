"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { candidateSlug } from "@/lib/slug";
import { uploadEventPhoto } from "@/lib/storage";
import { validateCoverFile } from "@/lib/cover-media";
import { TEMPLATES } from "@/lib/templates";
import { EVENT_TYPES } from "@/lib/event-types";
import type { EventType } from "@/lib/supabase/types";

export type CreateEventError =
  | "choose_type"
  | "enter_name"
  | "choose_date"
  | "choose_template"
  | "photo_type"
  | "photo_size"
  | "generic"
  | "slug";

export interface CreateEventState {
  error?: CreateEventError;
}

const EVENT_TYPE_IDS = new Set(EVENT_TYPES.map((t) => t.id));
const TEMPLATE_IDS = new Set(TEMPLATES.map((t) => t.id));

const POSTGRES_UNIQUE_VIOLATION = "23505";
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
    redirect("/login");
  }

  const eventType = String(formData.get("event_type") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "");
  const eventTime = String(formData.get("event_time") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const templateId = String(formData.get("template_id") ?? "classic");
  const photo = formData.get("photo");

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
        event_time: eventTime || null,
        location: location || null,
        description: description || null,
        template_id: templateId,
        slug,
      })
      .select("id, slug")
      .single();

    if (!error && data) {
      insertedId = data.id;
      insertedSlug = data.slug;
      break;
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

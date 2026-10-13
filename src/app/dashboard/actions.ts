"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteEventsWithMedia } from "@/lib/event-cleanup";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Deletes one of the caller's own invitations, with its images.
 *
 * Ownership is established with the caller's own session: RLS returns the row
 * only to its organizer, so someone passing another person's id finds nothing
 * and nothing is deleted. Only then is the service-role client used, because
 * removing the uploaded files is not something an organizer's session can do.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: event } = await supabase
    .from("events")
    .select("id, organizer_id")
    .eq("id", eventId)
    .maybeSingle();

  if (event && event.organizer_id === user.id) {
    await deleteEventsWithMedia(createAdminClient(), [event]);
  }

  revalidatePath("/dashboard");
}

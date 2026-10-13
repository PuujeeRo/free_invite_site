"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteEventsWithMedia } from "@/lib/event-cleanup";
import { disconnectGmail } from "@/lib/email/gmail";

export interface ProfileState {
  saved?: boolean;
  error?: "generic";
}

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("display_name") ?? "").trim().slice(0, 60);

  // Through the organizer's own session: RLS lets them change their own row
  // and nobody else's. The .select() matters -- an update that matches no row
  // is not an error, so without it a failed save would be reported as saved.
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: name || null })
    .eq("id", user.id)
    .select("id");

  if (error || !data || data.length === 0) return { error: "generic" };

  revalidatePath("/dashboard", "layout");
  return { saved: true };
}

export async function disconnectGmailFromProfile(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await disconnectGmail(user.id);
  revalidatePath("/dashboard/profile");
}

/**
 * Deletes the caller's account and everything that belongs to it.
 *
 * In this order on purpose. The images go first, while the rows that say
 * where they are still exist; the Gmail grant is revoked while its token can
 * still be read; and the sign-in itself goes last, so a failure part-way
 * leaves an account the person can still get into and try again from, rather
 * than orphaned data nobody can reach.
 */
export async function deleteAccount(): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  try {
    const { data: events, error } = await admin
      .from("events")
      .select("id, organizer_id")
      .eq("organizer_id", user.id);
    if (error) return { error: "generic" };
    await deleteEventsWithMedia(admin, events ?? []);
    await disconnectGmail(user.id);

    // Removing the auth user cascades to the profile row (0001).
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) return { error: "generic" };
  } catch {
    return { error: "generic" };
  }

  await supabase.auth.signOut();
  redirect("/");
}

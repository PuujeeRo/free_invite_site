"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmailProvider } from "@/lib/email";
import { GmailEmailProvider, disconnectGmail, getGmailConnection } from "@/lib/email/gmail";
import { buildInviteEmail } from "@/lib/email/invite-template";
import { invitationUrl } from "@/lib/site-url";
import { FREE_EMAIL_SEND_LIMIT } from "@/lib/event-types";
import { isPastIso } from "@/lib/time";

export type AddGuestError = "missing_event" | "required" | "generic";

export interface AddGuestState {
  error?: AddGuestError;
}

export async function addNamedGuest(
  _prevState: AddGuestState,
  formData: FormData
): Promise<AddGuestState> {
  const eventId = String(formData.get("event_id") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!eventId) {
    return { error: "missing_event" };
  }
  if (!firstName) {
    return { error: "required" };
  }

  const supabase = await createClient();
  // RLS (named_guests_owner_all) rejects this insert unless the caller's session
  // owns the parent event, so there's no separate ownership check needed here.
  const { error } = await supabase.from("named_guests").insert({
    event_id: eventId,
    first_name: firstName,
    last_name: lastName || null,
    email: email || null,
  });

  if (error) {
    return { error: "generic" };
  }

  revalidatePath(`/dashboard/${eventId}`);
  return {};
}

export type SendGuestEmailError = "not_found" | "no_email" | "expired" | "limit_reached" | "gmail_reconnect" | "generic";

export interface SendGuestEmailState {
  error?: SendGuestEmailError;
  sentGuestId?: string;
}

export async function sendGuestEmail(
  _prevState: SendGuestEmailState,
  formData: FormData
): Promise<SendGuestEmailState> {
  const eventId = String(formData.get("event_id") ?? "");
  const guestId = String(formData.get("guest_id") ?? "");

  const supabase = await createClient();

  // RLS scopes both reads to the caller's own event/guests -- a stranger
  // passing another organizer's ids just gets nulls below, not their data.
  const { data: event } = await supabase
    .from("events")
    .select("id, name, event_type, event_date, event_time, location, slug, is_paid, expires_at")
    .eq("id", eventId)
    .maybeSingle();
  const { data: guest } = await supabase
    .from("named_guests")
    .select("*")
    .eq("id", guestId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!event || !guest) {
    return { error: "not_found" };
  }
  if (!guest.email) {
    return { error: "no_email" };
  }
  // The link would only show "expired" to the guest, so do not send it.
  if (!event.is_paid && isPastIso(event.expires_at)) {
    return { error: "expired" };
  }

  // From the organizer's own Gmail when they have connected it, otherwise
  // from the site's sender. The per-invitation cap protects the site's sending
  // quota, so it does not apply to mail that leaves from their own account.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const gmail = user ? await getGmailConnection(user.id) : null;

  if (!event.is_paid && !gmail) {
    const { count } = await supabase
      .from("named_guests")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .not("email_sent_at", "is", null);

    if ((count ?? 0) >= FREE_EMAIL_SEND_LIMIT) {
      return { error: "limit_reached" };
    }
  }

  const { subject, html, text } = buildInviteEmail({
    event,
    guestFirstName: guest.first_name,
    guestLastName: guest.last_name,
    link: invitationUrl(event.slug, guest.guest_token),
  });

  const provider = gmail ? new GmailEmailProvider(gmail) : getEmailProvider();
  const result = await provider.send({ to: guest.email, subject, html, text });

  if (!result.ok) {
    const reconnect = provider instanceof GmailEmailProvider && provider.needsReconnect;
    return { error: reconnect ? "gmail_reconnect" : "generic" };
  }

  await supabase
    .from("named_guests")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", guestId);

  revalidatePath(`/dashboard/${eventId}`);
  return { sentGuestId: guestId };
}

export async function disconnectGmailAction(eventId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await disconnectGmail(user.id);
  revalidatePath(`/dashboard/${eventId}`);
}

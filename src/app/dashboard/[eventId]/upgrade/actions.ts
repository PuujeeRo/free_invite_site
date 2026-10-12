"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/payments";
import { PAID_PRICE_MNT, PAYMENTS_ENABLED } from "@/lib/event-types";

export async function startCheckout(eventId: string) {
  // A server action is its own public endpoint, callable without ever loading
  // the page that renders its form, so the page's guard does not cover it.
  if (!PAYMENTS_ENABLED) {
    redirect(`/dashboard/${eventId}`);
  }

  const supabase = await createClient();

  // RLS scopes this to the caller's own event; a stranger passing another
  // organizer's eventId just gets null here, not their event.
  const { data: event } = await supabase
    .from("events")
    .select("id, name, is_paid")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    redirect("/dashboard");
  }
  if (event.is_paid) {
    redirect(`/dashboard/${eventId}`);
  }

  // Resolved before the insert so the payment row records which provider and
  // currency it was actually created for, rather than relying on a column
  // default that may not match.
  const provider = getPaymentProvider();

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      event_id: eventId,
      amount: PAID_PRICE_MNT,
      currency: provider.currency,
      provider: provider.name,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !payment) {
    redirect(`/dashboard/${eventId}/upgrade?error=1`);
  }

  // Keep the redirect() calls out of this try block: Next.js implements
  // redirect() by throwing, and catching broadly here would swallow that throw
  // instead of letting it propagate.
  let checkoutUrl: string;
  try {
    const invoice = await provider.createInvoice({
      eventId,
      paymentId: payment.id,
      amount: PAID_PRICE_MNT,
      description: `Naashir — ${event.name}`,
    });
    checkoutUrl = invoice.checkoutUrl;

    await supabase
      .from("payments")
      .update({
        provider_ref: invoice.providerRef,
        // Persisted so the checkout page can re-render the same QR on reload
        // instead of minting a second QPay invoice per page view.
        checkout: invoice.checkout ?? null,
      })
      .eq("id", payment.id);
  } catch {
    await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
    redirect(`/dashboard/${eventId}/upgrade?error=1`);
  }

  redirect(checkoutUrl);
}

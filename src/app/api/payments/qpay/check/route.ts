import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { QPayProvider } from "@/lib/payments/qpay";
import { markPaymentPaid } from "@/lib/payments/mark-paid";

// Polled by the QPay checkout page while the payer is in their banking app.
//
// QPay's callback is the authoritative path, but it is a server-to-server ping
// that the payer's browser never sees, and it does not arrive at all if the
// site is unreachable from QPay at that moment (local dev, a tunnel that went
// down, a cold start that timed out). Polling the same /payment/check endpoint
// from the page means the organizer's upgrade unlocks on the screen they are
// actually looking at, rather than after a manual refresh minutes later.
//
// The payment id is an unguessable uuid and this only ever reports status --
// nothing here can mark a payment paid that QPay has not confirmed.
export async function GET(request: NextRequest) {
  const paymentId = request.nextUrl.searchParams.get("payment_id");
  if (!paymentId) {
    return NextResponse.json({ error: "missing_payment_id" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, event_id, status, provider, provider_ref")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment) {
    return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
  }
  if (payment.status === "paid") {
    return NextResponse.json({ status: "paid", eventId: payment.event_id });
  }
  if (payment.provider !== "qpay" || !payment.provider_ref) {
    return NextResponse.json({ status: payment.status, eventId: payment.event_id });
  }

  const paid = await new QPayProvider().isInvoicePaid(payment.provider_ref).catch(() => false);
  if (!paid) {
    return NextResponse.json({ status: payment.status, eventId: payment.event_id });
  }

  const result = await markPaymentPaid(paymentId);
  return NextResponse.json({
    status: result.ok ? "paid" : payment.status,
    eventId: payment.event_id,
  });
}

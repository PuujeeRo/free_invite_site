"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { QPayProvider } from "@/lib/payments/qpay";
import { getSiteUrl } from "@/lib/site-url";
import { parseTipAmount, tipsOnline } from "@/lib/tips";

export type TipError = "amount" | "unavailable" | "generic";

export interface TipState {
  error?: TipError;
}

// Open to everyone, signed in or not, so everything is written with the
// service-role client and every value is checked here: the table has no
// policies and the form is not the only way to call this.
export async function startTip(_prev: TipState, formData: FormData): Promise<TipState> {
  if (!tipsOnline()) return { error: "unavailable" };

  const amount = parseTipAmount(formData.get("amount_custom") || formData.get("amount"));
  if (!amount) return { error: "amount" };

  const name = String(formData.get("display_name") ?? "").trim().slice(0, 60);
  const message = String(formData.get("message") ?? "").trim().slice(0, 200);
  // Shown publicly only when asked for, and only with a name to show.
  const isPublic = formData.get("is_public") === "on" && name.length > 0;

  const supabase = createAdminClient();
  const { data: tip, error } = await supabase
    .from("tips")
    .insert({
      amount,
      currency: "MNT",
      provider: "qpay",
      status: "pending",
      display_name: name || null,
      message: message || null,
      is_public: isPublic,
    })
    .select("id")
    .single();

  if (error || !tip) return { error: "generic" };

  // redirect() works by throwing, so it stays outside the try block.
  let checkoutPath: string;
  try {
    const invoice = await new QPayProvider().createInvoice({
      invoiceNo: tip.id,
      amount,
      description: "Naashir tip",
      callbackUrl: `${getSiteUrl()}/api/tips/webhook?tip_id=${tip.id}`,
      checkoutUrl: `${getSiteUrl()}/tip/${tip.id}`,
    });
    await supabase
      .from("tips")
      .update({ provider_ref: invoice.providerRef, checkout: invoice.checkout ?? null })
      .eq("id", tip.id);
    checkoutPath = `/tip/${tip.id}`;
  } catch {
    await supabase.from("tips").update({ status: "failed" }).eq("id", tip.id);
    return { error: "generic" };
  }

  redirect(checkoutPath);
}

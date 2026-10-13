import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { QPayProvider, qpayCredentials } from "@/lib/payments/qpay";
import { TIP_MAX_MNT, TIP_MIN_MNT } from "@/lib/tip-amounts";

// Tips are voluntary and unlock nothing. A tip has no event, and the person
// tipping need not have an account.

/** Online tipping needs a QPay merchant account; without one the page falls back to bank details. */
export function tipsOnline(): boolean {
  return Boolean(qpayCredentials() && process.env.QPAY_INVOICE_CODE);
}

export interface TipBankDetails {
  bank: string;
  account: string;
  holder: string | null;
}

/** Plain bank-transfer details, shown when QPay is not set up. */
export function tipBankDetails(): TipBankDetails | null {
  const bank = process.env.TIP_BANK_NAME;
  const account = process.env.TIP_BANK_ACCOUNT;
  if (!bank || !account) return null;
  return { bank, account, holder: process.env.TIP_BANK_HOLDER ?? null };
}

export function parseTipAmount(value: unknown): number | null {
  const amount = Math.round(Number(String(value ?? "").replace(/[\s,₮]/g, "")));
  return Number.isFinite(amount) && amount >= TIP_MIN_MNT && amount <= TIP_MAX_MNT ? amount : null;
}

/**
 * Confirms a tip with QPay and marks it paid. QPay's callback is not
 * authenticated, so neither it nor the page's polling is ever believed on its
 * own: both end up here, and only QPay's own answer flips the row.
 */
export async function settleTip(tipId: string): Promise<"paid" | "pending" | "not_found"> {
  const supabase = createAdminClient();
  const { data: tip } = await supabase
    .from("tips")
    .select("id, status, provider_ref")
    .eq("id", tipId)
    .maybeSingle();

  if (!tip) return "not_found";
  if (tip.status === "paid") return "paid";
  if (!tip.provider_ref) return "pending";

  const paid = await new QPayProvider().isInvoicePaid(tip.provider_ref).catch(() => false);
  if (!paid) return "pending";

  await supabase
    .from("tips")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", tipId)
    .neq("status", "paid");
  return "paid";
}

export interface Supporter {
  name: string;
  message: string | null;
}

/**
 * The public thank-you list: people who paid and asked to be shown. Names and
 * messages only -- the amount is never selected here, so it cannot leak into
 * the page.
 */
export async function recentSupporters(limit = 30): Promise<Supporter[]> {
  try {
    const { data } = await createAdminClient()
      .from("tips")
      .select("display_name, message")
      .eq("status", "paid")
      .eq("is_public", true)
      .not("display_name", "is", null)
      .order("paid_at", { ascending: false })
      .limit(limit);
    return (data ?? []).flatMap((row) =>
      row.display_name ? [{ name: row.display_name, message: row.message }] : []
    );
  } catch {
    return []; // includes a database without the tips table yet
  }
}

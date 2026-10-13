import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import { PageContainer } from "@/components/layout/PageContainer";
import { PublicHeader } from "@/components/layout/PublicHeader";
import type { CheckoutPayload } from "@/lib/payments/types";
import { QPayCheckout } from "@/components/tip/QPayCheckout";

// The QR and bank buttons for one tip. Read with the service-role client
// because the payer may not be signed in; the id in the URL is an unguessable
// uuid and the page shows nothing but the amount and how to pay it.
export default async function TipCheckoutPage({ params }: { params: Promise<{ tipId: string }> }) {
  const { tipId } = await params;
  const { data: tip } = await createAdminClient()
    .from("tips")
    .select("id, amount, status, checkout")
    .eq("id", tipId)
    .maybeSingle();

  if (!tip) notFound();
  if (tip.status === "paid") redirect("/tip?thanks=1");

  const t = getDictionary(await getLocale());
  const checkout = (tip.checkout ?? {}) as CheckoutPayload;
  const payable =
    Boolean(checkout.qrImage) || Boolean(checkout.shortUrl) || (checkout.deeplinks?.length ?? 0) > 0;
  if (!payable) redirect("/tip");

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader maxWidth="md" />
      <PageContainer maxWidth="md">
        <header className="text-center">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t.tip.checkoutTitle}</h1>
          <p className="mt-1 text-3xl font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
            {tip.amount.toLocaleString("en-US")}₮
          </p>
        </header>
        <div className="mt-8">
          <QPayCheckout
            checkUrl={`/api/tips/check?tip_id=${tip.id}`}
            doneHref="/tip?thanks=1"
            qrImage={checkout.qrImage ?? null}
            shortUrl={checkout.shortUrl ?? null}
            deeplinks={checkout.deeplinks ?? []}
            labels={{
              ...t.qpay,
              paidTitle: t.tip.thanksTitle,
              paidBody: t.tip.thanksBody,
              backToEvent: t.tip.backToTip,
            }}
          />
        </div>
      </PageContainer>
    </div>
  );
}

export const dynamic = "force-dynamic";

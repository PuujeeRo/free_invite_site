import { notFound, redirect } from "next/navigation";
import { CheckCircleIcon, LockSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import { PAID_PRICE_MNT, PAYMENTS_ENABLED } from "@/lib/event-types";
import { PageContainer } from "@/components/layout/PageContainer";
import type { EventRow } from "@/lib/supabase/types";
import { startCheckout } from "./actions";

export default async function UpgradePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  // Hiding the links is not enough: this URL is guessable and the checkout
  // behind it charges real money.
  if (!PAYMENTS_ENABLED) notFound();

  const { eventId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle<EventRow>();

  // Same distinction the QPay checkout page makes: a database that briefly
  // could not be reached is a 500 to retry, not a 404 telling the organizer
  // their event no longer exists.
  if (eventError) {
    throw new Error(`Could not load event ${eventId}: ${eventError.message}`);
  }

  if (!event) notFound();
  if (event.is_paid) redirect(`/dashboard/${eventId}`);

  const locale = await getLocale();
  const t = getDictionary(locale);
  const checkout = startCheckout.bind(null, eventId);

  const features = [
    t.upgrade.featureNoWatermark,
    t.upgrade.featureUnlimitedGuests,
    t.upgrade.featureCustomDesign,
    t.upgrade.featureCustomText,
    t.upgrade.featureMedia,
  ];

  return (
    <PageContainer maxWidth="md">
      <header className="text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{event.name}</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {t.upgrade.title}
        </h1>
      </header>

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-4xl font-semibold text-zinc-900 dark:text-zinc-50">
            {PAID_PRICE_MNT.toLocaleString("en-US")}₮
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{t.upgrade.priceNote}</span>
        </div>

        <ul className="mt-6 space-y-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <CheckCircleIcon
                weight="fill"
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{feature}</span>
            </li>
          ))}
        </ul>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
          >
            {t.newEvent.errorGeneric}
          </p>
        )}

        <form action={checkout} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-transform hover:bg-zinc-700 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100"
          >
            {t.upgrade.payButton.replace("{price}", PAID_PRICE_MNT.toLocaleString("en-US"))}
          </button>
        </form>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <LockSimpleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t.upgrade.secureNote}
        </p>
      </div>
    </PageContainer>
  );
}

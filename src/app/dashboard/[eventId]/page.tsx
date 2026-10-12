import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { invitationUrl } from "@/lib/site-url";
import { daysRemaining } from "@/lib/time";
import { isGreeting } from "@/lib/greeting";
import { PAYMENTS_ENABLED } from "@/lib/event-types";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import { CopyLinkButton } from "@/components/share/CopyLinkButton";
import { MessengerShareButton } from "@/components/share/MessengerShareButton";
import { PageContainer } from "@/components/layout/PageContainer";
import { AddGuestForm } from "./AddGuestForm";
import { SendEmailButton } from "./SendEmailButton";
import type { EventRow, NamedGuestRow } from "@/lib/supabase/types";

export default async function EventOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { eventId } = await params;
  const { paid } = await searchParams;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle<EventRow>();

  if (!event) notFound();

  const { data: guests } = await supabase
    .from("named_guests")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  const namedGuests = (guests ?? []) as NamedGuestRow[];
  const link = invitationUrl(event.slug);
  const daysLeft = daysRemaining(event.expires_at);
  const locale = await getLocale();
  const t = getDictionary(locale);

  const freeStatusLabel =
    daysLeft > 1
      ? t.eventOverview.freeDaysLeft.replace("{days}", String(daysLeft))
      : daysLeft === 1
        ? t.eventOverview.freeDayLeft
        : t.eventOverview.freeExpired;

  return (
    <PageContainer maxWidth="lg">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{event.name}</h1>
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/${event.id}/edit`} className="text-sm font-medium underline underline-offset-4">
            {t.edit.title}
          </Link>
          {/* A greeting collects no RSVPs, so there are no responses to view. */}
          {!isGreeting(event) && (
            <Link
              href={`/dashboard/${event.id}/guests`}
              className="text-sm font-medium underline underline-offset-4"
            >
              {t.eventOverview.viewResponses}
            </Link>
          )}
        </div>
      </div>

      {paid === "1" && event.is_paid && (
        <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {t.upgrade.paidBanner}
        </div>
      )}

      {!event.is_paid && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {/* The days-left status stays even with payments off: the 7-day
              limit still applies, only the way to buy out of it is hidden. */}
          <span>{freeStatusLabel}</span>
          {PAYMENTS_ENABLED && (
            <Link
              href={`/dashboard/${event.id}/upgrade`}
              className="font-medium underline underline-offset-4"
            >
              {t.eventOverview.upgrade}
            </Link>
          )}
        </div>
      )}

      <section className="mt-8 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{t.eventOverview.linkLabel}</p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-zinc-100 px-3 py-2 text-xs dark:bg-zinc-800">
            {link}
          </code>
          <CopyLinkButton url={link} />
        </div>
        <div className="mt-3">
          <MessengerShareButton url={link} title={event.name} />
        </div>
      </section>

      <section className="mt-8">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {t.eventOverview.personalizeTitle}
        </p>
        <p className="mt-1 text-xs text-zinc-500">{t.eventOverview.personalizeSubtitle}</p>
        <div className="mt-3">
          <AddGuestForm eventId={event.id} />
        </div>

        {namedGuests.length > 0 && (
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {namedGuests.map((guest) => {
              const guestLink = invitationUrl(event.slug, guest.guest_token);
              return (
                <li key={guest.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="text-sm text-zinc-800 dark:text-zinc-200">
                    {guest.first_name} {guest.last_name}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyLinkButton url={guestLink} label={t.eventOverview.guestLinkCopy} />
                    <MessengerShareButton url={guestLink} title={event.name} />
                    {guest.email && (
                      <SendEmailButton
                        eventId={event.id}
                        guestId={guest.id}
                        alreadySent={Boolean(guest.email_sent_at)}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}

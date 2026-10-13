import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { invitationUrl } from "@/lib/site-url";
import { daysRemaining, isPastIso } from "@/lib/time";
import { isGreeting } from "@/lib/greeting";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import { CopyLinkButton } from "@/components/share/CopyLinkButton";
import { MessengerShareButton } from "@/components/share/MessengerShareButton";
import { PageContainer } from "@/components/layout/PageContainer";
import { buildInviteEmail } from "@/lib/email/invite-template";
import { buildComposeLinks } from "@/lib/email/mime";
import { getGmailConnection, gmailConfigured } from "@/lib/email/gmail";
import { FREE_EMAIL_SEND_LIMIT } from "@/lib/event-types";
import { disconnectGmailAction } from "./actions";
import { AddGuestForm } from "./AddGuestForm";
import { SendEmailButton } from "./SendEmailButton";
import type { EventRow, EventViewStats, NamedGuestRow } from "@/lib/supabase/types";

export default async function EventOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ gmail?: string }>;
}) {
  const { eventId } = await params;
  const { gmail: gmailResult } = await searchParams;
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

  // Who opened the invitation, per device. Absent (not zero) when the database
  // does not have the function yet, so the section is simply not shown.
  const { data: statRows } = await supabase.rpc("event_view_stats", { p_event_id: eventId });
  const stats: EventViewStats | null = Array.isArray(statRows) && statRows[0] ? statRows[0] : null;
  const link = invitationUrl(event.slug);

  // Sending from the organizer's own Gmail: offered only when the site has a
  // Google OAuth client, and only used once they have connected.
  const gmailOffered = gmailConfigured();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const gmail = gmailOffered && user ? await getGmailConnection(user.id) : null;
  const daysLeft = daysRemaining(event.expires_at);
  // Once the link has stopped working there is nothing to email: the buttons
  // go, and sendGuestEmail refuses as well for a request made without them.
  const linkExpired = !event.is_paid && isPastIso(event.expires_at);
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

      {!event.is_paid && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <span>{freeStatusLabel}</span>
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

      {stats && (
        <section className="mt-8">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{t.eventOverview.statsTitle}</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                [t.eventOverview.statsDevices, stats.devices],
                [t.eventOverview.statsOpens, stats.opens],
                [t.eventOverview.statsMap, stats.map_clicks],
                [t.eventOverview.statsCalendar, stats.calendar_clicks],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <dd className="text-2xl font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
                  {Number(value).toLocaleString("en-US")}
                </dd>
                <dt className="text-xs text-zinc-500">{label}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-zinc-500">{t.eventOverview.statsHint}</p>
        </section>
      )}

      <section className="mt-8">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {t.eventOverview.personalizeTitle}
        </p>
        <p className="mt-1 text-xs text-zinc-500">{t.eventOverview.personalizeSubtitle}</p>
        <div className="mt-3">
          <AddGuestForm eventId={event.id} />
        </div>

        {/* How a guest with an email address can be invited, and from whose
            address. Spelled out because there are three buttons per guest and
            they differ in exactly this. */}
        <div className="mt-4 rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{t.eventOverview.emailTitle}</p>
          <p className="mt-1 text-xs text-pretty text-zinc-500">
            {t.eventOverview.emailInfo.replace("{limit}", String(FREE_EMAIL_SEND_LIMIT))}
          </p>
          {gmailOffered && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              {gmail ? (
                <>
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {t.eventOverview.gmailConnected.replace("{email}", gmail.email)}
                  </span>
                  <form action={disconnectGmailAction.bind(null, event.id)}>
                    <button type="submit" className="font-medium underline underline-offset-4">
                      {t.eventOverview.gmailDisconnect}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  {/* A plain link: this leaves the site for Google's consent
                      screen, which a client-side navigation cannot do. */}
                  <a
                    href={`/api/google/connect?back=/dashboard/${event.id}`}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    {t.eventOverview.gmailConnect}
                  </a>
                  <span className="text-pretty text-zinc-500">{t.eventOverview.gmailConnectHint}</span>
                </>
              )}
            </div>
          )}
          {gmailResult && gmailResult !== "connected" && (
            <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
              {gmailResult === "cancelled"
                ? t.eventOverview.gmailCancelled
                : gmailResult === "denied"
                  ? t.eventOverview.gmailDenied
                  : t.eventOverview.gmailFailed}
            </p>
          )}
        </div>

        {namedGuests.length > 0 && (
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {namedGuests.map((guest) => {
              const guestLink = invitationUrl(event.slug, guest.guest_token);
              // A ready-written draft in the organizer's own mail program.
              const mail = guest.email
                ? buildInviteEmail({
                    event,
                    guestFirstName: guest.first_name,
                    guestLastName: guest.last_name,
                    link: guestLink,
                  })
                : null;
              const compose =
                guest.email && mail && !linkExpired
                  ? buildComposeLinks({ to: guest.email, subject: mail.subject, body: mail.text })
                  : null;
              return (
                <li key={guest.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="text-sm text-zinc-800 dark:text-zinc-200">
                    {guest.first_name} {guest.last_name}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyLinkButton url={guestLink} label={t.eventOverview.guestLinkCopy} />
                    <MessengerShareButton url={guestLink} title={event.name} />
                    {compose && (
                      <>
                        <a href={compose.gmail} target="_blank" rel="noopener noreferrer" className={composeClass}>
                          {t.eventOverview.composeGmail}
                        </a>
                        <a href={compose.mailto} className={composeClass}>
                          {t.eventOverview.composeMail}
                        </a>
                      </>
                    )}
                    {guest.email && !linkExpired && (
                      <SendEmailButton
                        eventId={event.id}
                        guestId={guest.id}
                        alreadySent={Boolean(guest.email_sent_at)}
                        viaGmail={Boolean(gmail)}
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

const composeClass =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 visited:text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300 dark:visited:text-zinc-300";

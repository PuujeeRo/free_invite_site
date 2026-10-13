import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import { PageContainer } from "@/components/layout/PageContainer";
import { EXPIRED_GRACE_DAYS, MAX_LIVE_INVITATIONS } from "@/lib/event-types";
import { isPastIso } from "@/lib/time";
import type { EventRow } from "@/lib/supabase/types";
import { DeleteEventButton } from "./DeleteEventButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = (events ?? []) as EventRow[];
  const locale = await getLocale();
  const t = getDictionary(locale);

  // "Live" is what the limit counts: unpaid and not yet expired. Paid events
  // are outside it, and expired ones are on their way to being cleaned up.
  const isExpired = (event: EventRow) => !event.is_paid && isPastIso(event.expires_at);
  const live = rows.filter((event) => !event.is_paid && !isExpired(event)).length;
  const atLimit = live >= MAX_LIVE_INVITATIONS;
  const anyExpired = rows.some(isExpired);

  return (
    <PageContainer maxWidth="2xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t.dashboard.title}</h1>
          {rows.length > 0 && (
            <p className="mt-1 text-xs text-zinc-500 tabular-nums">
              {t.dashboard.liveCount
                .replace("{count}", String(live))
                .replace("{live}", String(MAX_LIVE_INVITATIONS))}
            </p>
          )}
        </div>
        {!atLimit && (
          <Link
            href="/create"
            className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white visited:text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:visited:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {t.dashboard.newInvitation}
          </Link>
        )}
      </div>

      {atLimit && (
        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-pretty text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-medium">
            {t.dashboard.liveLimitTitle.replace("{live}", String(MAX_LIVE_INVITATIONS))}
          </p>
          <p className="mt-0.5">{t.dashboard.liveLimitBody}</p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-2 text-center">
          <p className="text-zinc-600 dark:text-zinc-400">{t.dashboard.empty}</p>
          <Link href="/create" className="text-sm font-medium underline underline-offset-4">
            {t.dashboard.createFirst}
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
              <div className="min-w-0">
                <Link
                  href={`/dashboard/${event.id}`}
                  className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
                >
                  {event.name}
                </Link>
                <p className="text-sm text-zinc-500 dark:text-zinc-500">
                  {event.event_date} · /{event.slug} ·{" "}
                  {event.is_paid ? t.dashboard.paid : isExpired(event) ? t.dashboard.expired : t.dashboard.free}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href={`/dashboard/${event.id}/guests`}
                  className="text-sm font-medium text-zinc-700 underline underline-offset-4 dark:text-zinc-300"
                >
                  {t.dashboard.viewResponses}
                </Link>
                <DeleteEventButton
                  eventId={event.id}
                  label={t.dashboard.delete}
                  pendingLabel={t.dashboard.deleting}
                  confirmText={t.dashboard.deleteConfirm.replace("{name}", event.name)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {anyExpired && (
        <p className="mt-6 text-xs text-zinc-500">
          {t.dashboard.expiredNote.replace("{days}", String(EXPIRED_GRACE_DAYS))}
        </p>
      )}
    </PageContainer>
  );
}

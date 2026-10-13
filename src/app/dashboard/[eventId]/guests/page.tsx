import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import { PageContainer } from "@/components/layout/PageContainer";
import type { EventRow, NamedGuestRow, RsvpRow } from "@/lib/supabase/types";

export default async function GuestsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle<EventRow>();

  if (!event) notFound();

  const [{ data: namedGuestsData }, { data: rsvpsData }] = await Promise.all([
    supabase.from("named_guests").select("*").eq("event_id", eventId).order("created_at"),
    supabase.from("rsvps").select("*").eq("event_id", eventId).order("updated_at", { ascending: false }),
  ]);

  const namedGuests = (namedGuestsData ?? []) as NamedGuestRow[];
  const rsvps = (rsvpsData ?? []) as RsvpRow[];

  const rsvpByNamedGuestId = new Map(rsvps.filter((r) => r.named_guest_id).map((r) => [r.named_guest_id, r]));
  const anonymousRsvps = rsvps.filter((r) => !r.named_guest_id);

  const going = rsvps.filter((r) => r.status === "yes").length;
  const notGoing = rsvps.filter((r) => r.status === "no").length;
  const maybe = rsvps.filter((r) => r.status === "maybe").length;
  const noAnswer = namedGuests.filter((g) => !rsvpByNamedGuestId.has(g.id)).length;
  const totalPeopleAttending = rsvps
    .filter((r) => r.status === "yes")
    .reduce((sum, r) => sum + r.party_size, 0);

  const locale = await getLocale();
  const t = getDictionary(locale);
  const statusLabel: Record<RsvpRow["status"], string> = {
    yes: t.guests.going,
    no: t.guests.notGoing,
    maybe: t.guests.maybe,
  };

  return (
    <PageContainer maxWidth="xl">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        {event.name} — {t.guests.titleSuffix}
      </h1>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t.guests.going} value={going} />
        <StatTile label={t.guests.notGoing} value={notGoing} />
        <StatTile label={t.guests.maybe} value={maybe} />
        <StatTile label={t.guests.noAnswer} value={namedGuests.length > 0 ? noAnswer : "—"} />
      </div>

      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        {t.guests.totalAttending}: <strong>{totalPeopleAttending}</strong>
      </p>

      {namedGuests.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.guests.namedGuests}</h2>
          <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
            {namedGuests.map((guest) => {
              const rsvp = rsvpByNamedGuestId.get(guest.id);
              return (
                <li key={guest.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-zinc-800 dark:text-zinc-200">
                    {guest.first_name} {guest.last_name}
                  </span>
                  <span className="text-zinc-500">
                    {rsvp
                      ? `${statusLabel[rsvp.status]}${rsvp.status === "yes" ? ` · ${rsvp.party_size}` : ""}`
                      : t.guests.noAnswer}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {namedGuests.length > 0 ? t.guests.otherResponses : t.guests.responses}
        </h2>
        {anonymousRsvps.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">{t.guests.noResponsesYet}</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
            {anonymousRsvps.map((rsvp) => (
              <li key={rsvp.id} className="flex items-center justify-between py-3 text-sm">
                <span className="text-zinc-800 dark:text-zinc-200">
                  {rsvp.display_name || t.guests.guestFallback}
                </span>
                <span className="text-zinc-500">
                  {statusLabel[rsvp.status]}
                  {rsvp.status === "yes" ? ` · ${rsvp.party_size}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

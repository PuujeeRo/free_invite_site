import { createAdminClient } from "@/lib/supabase/admin";
import { InvitationCard } from "@/components/templates/InvitationCard";
import { RsvpWidget } from "@/components/rsvp/RsvpWidget";
import { isPastIso } from "@/lib/time";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import { TopControls } from "@/components/theme/TopControls";
import { isGreeting } from "@/lib/greeting";
import { featuresUnlocked } from "@/lib/event-types";
import { httpLinkOrNull } from "@/lib/safe-link";
import { buildGoogleCalendarUrl } from "@/lib/calendar";
import { buildMapEmbedUrl } from "@/lib/map-embed";
import { MapEmbed } from "@/components/templates/MapEmbed";
import { readGallery } from "@/lib/gallery";
import { proxiedImageUrl } from "@/lib/image-proxy";
import { invitationUrl } from "@/lib/site-url";
import { parseCoverLayout } from "@/lib/supabase/types";
import { AccountButton } from "@/components/account/AccountButton";
import { HeaderRow } from "@/components/layout/HeaderRow";
import { readTheme, readCustomText } from "@/lib/theme";
import { FreeInviteAdSlot } from "@/components/ads/FreeInviteAdSlot";
import { countdownLabelsFrom } from "@/lib/countdown-labels";
import type { EventRow, NamedGuestRow } from "@/lib/supabase/types";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ to?: string }>;
}) {
  const { slug } = await params;
  const { to } = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);

  const supabase = createAdminClient();
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<EventRow>();

  if (!event) {
    return <CenteredMessage>{t.invite.notFound}</CenteredMessage>;
  }

  const isExpired = !event.is_paid && isPastIso(event.expires_at);
  if (isExpired) {
    return <CenteredMessage>{t.invite.expired}</CenteredMessage>;
  }

  let guest: NamedGuestRow | null = null;
  if (to) {
    const { data } = await supabase
      .from("named_guests")
      .select("*")
      .eq("event_id", event.id)
      .eq("guest_token", to)
      .maybeSingle<NamedGuestRow>();
    guest = data ?? null;
  }

  // Extras follow featuresUnlocked(); the watermark and the ad slot below
  // still follow is_paid itself.
  const unlocked = featuresUnlocked(event.is_paid);
  const greeting = isGreeting(event);
  const mapLink = unlocked && !greeting ? httpLinkOrNull(event.map_link) : null;
  const mapEmbed = buildMapEmbedUrl(mapLink);
  // Gallery images are external links: route each through /api/img so it is
  // cropped to the shape of the slot it will fill (tall for a full-background
  // card, 4:3 otherwise). The uploaded cover is ours already and goes direct.
  const coverLayout = parseCoverLayout(event.cover_layout);
  const gallery = readGallery(event.gallery_urls).map((url) =>
    proxiedImageUrl(url, coverLayout === "full" ? "3x4" : "4x3")
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-4 py-3">
        <HeaderRow maxWidth="md" justify="end">
          <div className="flex items-center gap-2">
            <TopControls />
            <AccountButton />
          </div>
        </HeaderRow>
      </header>
      <div className="flex flex-1 flex-col items-center gap-4 px-3 pb-10 sm:gap-6 sm:px-4">
        <InvitationCard
          eventName={event.name}
          eventType={event.event_type}
          kind={event.kind}
          senderName={event.sender_name}
          eventDate={event.event_date}
          eventTime={event.event_time}
          location={event.location}
          description={event.description}
          photoUrl={event.photo_url}
          coverLayout={coverLayout}
          gallery={gallery}
          templateId={event.template_id}
          isPaid={unlocked}
          showWatermark={!event.is_paid}
          calendarUrl={
            greeting
              ? null
              : buildGoogleCalendarUrl({
                  title: event.name,
                  date: event.event_date,
                  time: event.event_time,
                  location: event.location,
                  description: event.description,
                  invitationUrl: invitationUrl(event.slug),
                })
          }
          calendarLabel={t.invite.addToCalendar}
          guestFirstName={guest?.first_name}
          guestLastName={guest?.last_name}
          countdownEnabled={event.countdown_enabled}
          mapLink={mapLink}
          mapLinkLabel={t.invite.viewMap}
          watermarkText={t.invite.watermark}
          videoUrl={httpLinkOrNull(event.video_url)}
          theme={readTheme(event.theme)}
          customText={readCustomText(event.custom_text)}
          countdownLabels={countdownLabelsFrom(t)}
        />
        {mapEmbed && <MapEmbed src={mapEmbed} title={t.invite.viewMap} />}
        {/* A greeting asks nothing of the person receiving it. */}
        {!isGreeting(event) && (
          <RsvpWidget
            eventId={event.id}
            guestFirstName={guest?.first_name}
            guestLastName={guest?.last_name}
            guestToken={guest?.guest_token}
          />
        )}
        {!event.is_paid && <FreeInviteAdSlot />}
      </div>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24 text-center">
      <p className="max-w-sm text-zinc-600 dark:text-zinc-400">{children}</p>
    </div>
  );
}

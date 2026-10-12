"use client";

import { useMemo, useSyncExternalStore } from "react";
import { InvitationCard } from "@/components/templates/InvitationCard";
import { DemoRsvpWidget } from "@/components/rsvp/DemoRsvpWidget";
import { countdownLabelsFrom } from "@/lib/countdown-labels";
import { PREVIEW_DRAFT_KEY, parsePreviewDraft } from "@/lib/preview-draft";
import { coverBackgroundUrl } from "@/lib/cover-backgrounds";
import { featuresUnlocked } from "@/lib/event-types";
import { parseCardEffect, parseCoverBackground, parseCoverIcon } from "@/lib/theme";
import { buildMapEmbedUrl, previewMapLink } from "@/lib/map-embed";
import { MapEmbed } from "@/components/templates/MapEmbed";
import { buildGoogleCalendarUrl } from "@/lib/calendar";
import { parseCoverLayout } from "@/lib/supabase/types";
import { useI18n } from "@/i18n/I18nProvider";

// `storage` fires in every OTHER tab when the form writes the draft, which is
// exactly the case here: the form is in one tab, this preview in another.
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

// The raw string, not the parsed object: useSyncExternalStore compares
// snapshots by identity, and a freshly parsed object would differ every call.
const readRaw = () => window.localStorage.getItem(PREVIEW_DRAFT_KEY);
const readRawOnServer = () => null;

/**
 * The guest page, rendered from the unsaved draft instead of a database row.
 * Laid out like app/i/[slug]/page.tsx so that what the organizer checks here is
 * what guests get: the same card, at the same width, with the RSVP box under it
 * for an invitation and nothing under it for a greeting. Like the small
 * preview beside the form, it borrows a sample cover until one is chosen (a
 * card with no cover collapses to a strip of text, which reads as broken
 * rather than as "no image yet"), and says so in a note under the card.
 */
export function PreviewClient() {
  const { dict: t } = useI18n();
  const raw = useSyncExternalStore(subscribe, readRaw, readRawOnServer);
  const draft = useMemo(() => parsePreviewDraft(raw), [raw]);

  if (!draft) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-24 text-center">
        <p className="max-w-sm text-zinc-600 dark:text-zinc-400">{t.newEvent.previewEmpty}</p>
      </div>
    );
  }

  // Unsaved, so everything here is the browser's own view of the draft:
  // gallery links load directly (the cropping proxy only signs saved links),
  // and a Google short link has not been expanded yet, so its pin map only
  // appears after saving.
  const gallery = Array.isArray(draft.gallery) ? draft.gallery : [];
  const mapLink = draft.kind === "greeting" ? null : previewMapLink(draft.mapLink ?? "");
  const mapEmbed = buildMapEmbedUrl(mapLink);

  return (
    <div className="flex flex-1 flex-col items-center gap-4 px-3 pb-10 sm:gap-6 sm:px-4">
      <p className="w-full max-w-md rounded-xl bg-amber-50 px-4 py-2.5 text-center text-xs text-pretty text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        {t.newEvent.previewBanner}
      </p>
      <InvitationCard
        eventName={draft.name || t.newEvent.previewNamePlaceholder}
        eventType={draft.eventType}
        kind={draft.kind}
        senderName={draft.senderName || null}
        eventDate={draft.date}
        eventTime={draft.time || null}
        location={draft.location || null}
        description={draft.description || null}
        photoUrl={
          draft.photoUrl ??
          (gallery.length > 0
            ? null
            : coverBackgroundUrl(
                parseCoverBackground(draft.coverBackground),
                draft.eventType,
                parseCoverLayout(draft.coverLayout),
                parseCoverIcon(draft.coverIcon)
              ))
        }
        gallery={gallery}
        coverLayout={parseCoverLayout(draft.coverLayout)}
        mapLink={mapLink}
        calendarUrl={
          draft.kind === "greeting"
            ? null
            : buildGoogleCalendarUrl({
                title: draft.name || t.newEvent.previewNamePlaceholder,
                date: draft.date,
                time: draft.time,
                location: draft.location,
                description: draft.description,
              })
        }
        calendarLabel={t.invite.addToCalendar}
        templateId={draft.templateId}
        isPaid={featuresUnlocked(false)}
        showWatermark
        theme={{ effect: parseCardEffect(draft.effect) }}
        mapLinkLabel={t.invite.viewMap}
        watermarkText={t.invite.watermark}
        countdownLabels={countdownLabelsFrom(t)}
      />
      {mapEmbed && <MapEmbed src={mapEmbed} title={t.invite.viewMap} />}
      {draft.kind !== "greeting" && <DemoRsvpWidget />}
    </div>
  );
}

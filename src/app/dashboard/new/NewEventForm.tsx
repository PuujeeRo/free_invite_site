"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EVENT_TYPES,
  LINK_LIFETIME_DAYS,
  MAX_LIVE_INVITATIONS,
  featuresUnlocked,
  parseLifetimeDays,
} from "@/lib/event-types";
import { TEMPLATES, splitTemplates } from "@/lib/templates";
import { clearCreateStash, writeCreateStash, type CreateStash } from "@/lib/create-stash";
import { useI18n } from "@/i18n/I18nProvider";
import { CoverImageField } from "@/components/media/CoverImageField";
import { TemplatePicker } from "@/components/templates/TemplatePicker";
import { InvitationCard } from "@/components/templates/InvitationCard";
import { withCoverLimits } from "@/lib/cover-media";
import { countdownLabelsFrom } from "@/lib/countdown-labels";
import { DemoRsvpWidget } from "@/components/rsvp/DemoRsvpWidget";
import { coverBackgroundColors, coverBackgroundUrl } from "@/lib/cover-backgrounds";
import { sampleCoverEmoji } from "@/lib/demo-data";
import { CoverBackgroundField } from "@/components/media/CoverBackgroundField";
import { CoverIconField } from "@/components/media/CoverIconField";
import { MapLinkField } from "@/components/media/MapLinkField";
import { PREVIEW_DRAFT_KEY, type PreviewDraft } from "@/lib/preview-draft";
import { CoverLayoutField } from "@/components/media/CoverLayoutField";
import { EffectField } from "@/components/templates/EffectField";
import {
  parseCardEffect,
  parseCoverBackground,
  parseCoverIcon,
  type CardEffect,
  type CoverBackground,
} from "@/lib/theme";
import { previewMapLink } from "@/lib/map-embed";
import { MAX_GALLERY_IMAGES, galleryUrlsOrEmpty } from "@/lib/gallery";
import { buildGoogleCalendarUrl } from "@/lib/calendar";
import { parseCoverLayout, type CoverLayout, type EventKind, type EventType } from "@/lib/supabase/types";
import { createEvent, type CreateEventState } from "./actions";

const initialState: CreateEventState = {};

const ERROR_KEY = {
  choose_type: "errorChooseType",
  enter_name: "errorEnterName",
  choose_date: "errorChooseDate",
  choose_template: "errorChooseTemplate",
  photo_type: "photoErrorType",
  photo_size: "photoErrorSize",
  bad_map_link: "errorMapLink",
  bad_gallery: "errorGallery",
  live_limit: "errorLiveLimit",
  generic: "errorGeneric",
  slug: "errorSlug",
} as const;

const FIRST_TYPE = EVENT_TYPES[0].id;

// What the preview needs from the text inputs. They stay uncontrolled (the
// browser owns their value); this is a read-only snapshot taken on every change.
interface Details {
  name: string;
  senderName: string;
  date: string;
  time: string;
  location: string;
  mapLink: string;
  gallery: string;
  description: string;
}

const EMPTY: Details = { name: "", senderName: "", date: "", time: "", location: "", mapLink: "", gallery: "", description: "" };

function firstSuggestedTemplate(eventType: EventType): string {
  const { recommended, others } = splitTemplates(eventType);
  return (recommended[0] ?? others[0]).id;
}

export function NewEventForm({
  signedIn,
  atLiveLimit,
  initial,
}: {
  // The form is open to visitors; creating needs an account. A visitor who
  // submits is sent to sign in and comes back with `initial` holding what
  // they had entered (see lib/create-stash.ts and CreateFormLoader).
  signedIn: boolean;
  atLiveLimit: boolean;
  initial: CreateStash | null;
}) {
  const { dict: t } = useI18n();
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createEvent, initialState);

  // Every starting value below comes from `initial` when there is one. It was
  // written by this same form, but it has been through browser storage, so
  // each value is parsed back to a known one rather than trusted.
  const initialType = EVENT_TYPES.find((type) => type.id === initial?.event_type)?.id ?? FIRST_TYPE;

  const [kind, setKind] = useState<EventKind>(initial?.kind === "greeting" ? "greeting" : "invitation");
  const [eventType, setEventType] = useState<EventType>(initialType);
  const [templateId, setTemplateId] = useState(
    () => TEMPLATES.find((template) => template.id === initial?.template_id)?.id ?? firstSuggestedTemplate(initialType)
  );
  // Until the organizer picks a template themselves, the selection follows the
  // event type (a wedding starts on a wedding look). After a deliberate pick it
  // is theirs and switching event type no longer overrides it.
  const [templateChosen, setTemplateChosen] = useState(Boolean(initial));
  const [details, setDetails] = useState<Details>(() =>
    initial
      ? {
          name: (initial.name ?? "").trim(),
          senderName: (initial.sender_name ?? "").trim(),
          date: initial.event_date ?? "",
          time: initial.event_time ?? "",
          location: (initial.location ?? "").trim(),
          mapLink: (initial.map_link ?? "").trim(),
          gallery: initial.gallery_urls ?? "",
          description: (initial.description ?? "").trim(),
        }
      : EMPTY
  );
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [coverLayout, setCoverLayout] = useState<CoverLayout>(() => parseCoverLayout(initial?.cover_layout));
  // A new invitation starts with a built-in cover, so the card has the shape
  // of the demo from the first moment and what the preview shows is what gets
  // saved. "None" is one of the choices.
  const [coverBackground, setCoverBackground] = useState<CoverBackground>(() =>
    initial ? parseCoverBackground(initial.cover_background) : "auto"
  );
  const [coverIcon, setCoverIcon] = useState<string | null>(() => parseCoverIcon(initial?.cover_icon));
  const [effect, setEffect] = useState<CardEffect>(() => parseCardEffect(initial?.effect));
  const [lifetimeDays, setLifetimeDays] = useState<number>(() => parseLifetimeDays(initial?.lifetime_days));

  const greeting = kind === "greeting";
  // A new event is never paid yet, so this is just "are the extras open".
  const unlocked = featuresUnlocked(false);
  // Memoised on the raw text so the array keeps its identity between renders;
  // the draft-saving effect below depends on it.
  const previewGallery = useMemo(() => galleryUrlsOrEmpty(details.gallery), [details.gallery]);

  function selectKind(next: EventKind) {
    setKind(next);
    // Sender, time and location inputs only exist for one kind each, and come
    // back empty when their kind is selected again. Drop the remembered values
    // too, or the preview would show text that is no longer in any input.
    setDetails((d) => ({ ...d, senderName: "", time: "", location: "", mapLink: "" }));
  }

  function selectEventType(next: EventType) {
    setEventType(next);
    if (!templateChosen) setTemplateId(firstSuggestedTemplate(next));
  }

  function snapshot(form: HTMLFormElement) {
    const data = new FormData(form);
    const read = (key: string) => String(data.get(key) ?? "");
    setDetails({
      name: read("name").trim(),
      senderName: read("sender_name").trim(),
      date: read("event_date"),
      // Not rendered for a greeting, so these read back as "" there.
      time: read("event_time"),
      location: read("location").trim(),
      mapLink: read("map_link").trim(),
      gallery: read("gallery_urls"),
      description: read("description").trim(),
    });
  }

  // Mirror the unsaved draft into localStorage for the full-page preview (see
  // lib/preview-draft.ts). Written on every change rather than only when the
  // preview link is clicked, so a preview tab that is already open keeps up
  // with the form through the browser's `storage` event.
  useEffect(() => {
    const draft: PreviewDraft = {
      kind,
      eventType,
      templateId,
      photoUrl,
      coverLayout,
      coverBackground,
      coverIcon,
      gallery: previewGallery,
      effect,
      name: details.name,
      senderName: details.senderName,
      date: details.date,
      time: greeting ? "" : details.time,
      location: greeting ? "" : details.location,
      mapLink: greeting ? "" : details.mapLink,
      description: details.description,
    };
    try {
      window.localStorage.setItem(PREVIEW_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Storage can be unavailable (private mode, quota). The preview link
      // then shows its "nothing to preview" message; the form is unaffected.
    }
  }, [kind, eventType, templateId, photoUrl, coverLayout, coverBackground, coverIcon, previewGallery, effect, details, greeting]);

  // Submitted by hand rather than through the form's `action` alone: React
  // resets every uncontrolled field once a form action settles, so a rejected
  // submit (say, an oversized cover) would wipe everything the organizer typed
  // and leave the preview showing text the inputs no longer hold. Dispatching
  // the same action ourselves skips that reset. `action` stays on the form as
  // the no-JavaScript fallback.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Not signed in: this is the moment to ask. The browser has already
    // checked the required fields, so what is parked is a complete draft.
    if (!signedIn) {
      writeCreateStash(e.currentTarget);
      router.push("/login?next=/create");
      return;
    }
    clearCreateStash();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  const previewName = details.name || t.newEvent.previewNamePlaceholder;
  // {live}, not {max}: withCoverLimits already claims {max} for another number.
  const liveLimitText = t.newEvent.errorLiveLimit.replace("{live}", String(MAX_LIVE_INVITATIONS));

  const kinds: { id: EventKind; label: string; hint: string }[] = [
    { id: "invitation", label: t.newEvent.kindInvitation, hint: t.newEvent.kindInvitationHint },
    { id: "greeting", label: t.newEvent.kindGreeting, hint: t.newEvent.kindGreetingHint },
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-12">
      {/* The preview is a sibling of the form, not a child: it contains a
          working sample RSVP box, whose inputs must not be submitted with, or
          trigger snapshots of, the invitation being created. */}
      <form
        action={formAction}
        onSubmit={onSubmit}
        onChange={(e) => snapshot(e.currentTarget)}
        className="flex min-w-0 flex-col gap-10"
      >
        {atLiveLimit && (
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-pretty text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <p>{liveLimitText}</p>
            <Link href="/dashboard" className="mt-1 inline-block font-medium underline underline-offset-4">
              {t.dashboard.navLabel}
            </Link>
          </div>
        )}
        {initial && signedIn && !atLiveLimit && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-pretty text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            {t.newEvent.restoredNote}
          </p>
        )}

        <section>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.newEvent.stepKind}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {kinds.map((option) => (
              <label key={option.id} className={choiceClass}>
                <input
                  type="radio"
                  name="kind"
                  value={option.id}
                  checked={option.id === kind}
                  onChange={() => selectKind(option.id)}
                  className="sr-only"
                />
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{option.label}</span>
                <span className="text-xs text-pretty text-zinc-500">{option.hint}</span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.newEvent.stepType}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {EVENT_TYPES.map((type) => {
              // Each category wears its own colours and emoji -- the same pair
              // its built-in cover uses -- so the list can be scanned by eye
              // instead of read tile by tile.
              const [from, to] = coverBackgroundColors("auto", type.id) ?? ["#f3ecdf", "#e0d3bb"];
              return (
              <label key={type.id} className={`${choiceClass} relative overflow-hidden pl-[4.25rem]`}>
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 flex w-14 items-center justify-center text-xl"
                  // Colours come from data, so they cannot be classes.
                  style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
                >
                  {sampleCoverEmoji(type.id)}
                </span>
                <input
                  type="radio"
                  name="event_type"
                  value={type.id}
                  checked={type.id === eventType}
                  onChange={() => selectEventType(type.id)}
                  className="sr-only"
                />
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{type.labelMn}</span>
                <span className="text-xs text-zinc-500">{type.label}</span>
              </label>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.newEvent.stepDetails}</h2>
          <div className="mt-3 flex flex-col gap-3">
            {/* `name` holds the event name for an invitation and the
                recipient for a greeting -- same column, so same field name. */}
            <Field label={greeting ? t.newEvent.recipientLabel : t.newEvent.nameLabel}>
              <input name="name" defaultValue={initial?.name ?? ""} required maxLength={80} className={inputClass} />
            </Field>
            {greeting && (
              <Field label={t.newEvent.senderLabel}>
                <input name="sender_name" defaultValue={initial?.sender_name ?? ""} maxLength={80} className={inputClass} />
              </Field>
            )}
            {/* The date field keeps one position in the tree for both kinds, so
                switching kind does not remount it and drop what was typed.
                A greeting is a card, not a gathering: no time, no place. */}
            <div className={greeting ? "grid" : "grid grid-cols-2 gap-3"}>
              <Field label={t.newEvent.dateLabel}>
                <input type="date" name="event_date" defaultValue={initial?.event_date ?? ""} required className={inputClass} />
              </Field>
              {!greeting && (
                <Field label={t.newEvent.timeLabel}>
                  <input type="time" name="event_time" defaultValue={initial?.event_time ?? ""} className={inputClass} />
                </Field>
              )}
            </div>
            {!greeting && (
              <Field label={t.newEvent.locationLabel}>
                <input name="location" defaultValue={initial?.location ?? ""} maxLength={140} className={inputClass} />
              </Field>
            )}
            {!greeting && unlocked && (
              <MapLinkField
                label={t.edit.mapLinkLabel}
                hint={t.newEvent.mapLinkHint}
                defaultValue={initial?.map_link ?? ""}
                inputClass={inputClass}
              />
            )}
            <Field label={greeting ? t.newEvent.messageLabel : t.newEvent.descriptionLabel}>
              <textarea
                name="description"
                defaultValue={initial?.description ?? ""}
                maxLength={400}
                rows={greeting ? 5 : 3}
                className={inputClass}
              />
            </Field>
            <CoverImageField onPreviewChange={setPhotoUrl} />
            <Field label={t.newEvent.galleryLabel}>
              <textarea
                name="gallery_urls"
                defaultValue={initial?.gallery_urls ?? ""}
                rows={3}
                placeholder={"https://...\nhttps://..."}
                className={inputClass}
              />
              <span className="text-xs text-zinc-500">
                {t.newEvent.galleryHint.replace("{max}", String(MAX_GALLERY_IMAGES))}
              </span>
            </Field>
            <CoverBackgroundField eventType={eventType} value={coverBackground} onChange={setCoverBackground} />
            {coverBackground !== "none" && (
              <CoverIconField eventType={eventType} value={coverIcon} onChange={setCoverIcon} />
            )}
            <CoverLayoutField value={coverLayout} onChange={setCoverLayout} />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.newEvent.stepTemplate}</h2>
          <div className="mt-3">
            <TemplatePicker
              eventType={eventType}
              value={templateId}
              onChange={(id) => {
                setTemplateId(id);
                setTemplateChosen(true);
              }}
              previewName={previewName}
            />
          </div>
        </section>

        {unlocked && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.newEvent.stepEffect}</h2>
            <div className="mt-3">
              <EffectField value={effect} onChange={setEffect} />
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.newEvent.lifetimeTitle}</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:max-w-sm">
            {LINK_LIFETIME_DAYS.map((days) => (
              <label key={days} className={`${choiceClass} items-center text-center`}>
                <input
                  type="radio"
                  name="lifetime_days"
                  value={days}
                  checked={days === lifetimeDays}
                  onChange={() => setLifetimeDays(days)}
                  className="sr-only"
                />
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {t.newEvent.lifetimeDays.replace("{days}", String(days))}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">{t.newEvent.lifetimeHint}</p>
        </section>

        {state.error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {state.error === "live_limit" ? liveLimitText : withCoverLimits(t.newEvent[ERROR_KEY[state.error]])}
          </p>
        )}

        {!signedIn && <p className="-mb-6 text-xs text-pretty text-zinc-500">{t.newEvent.signInNote}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPending || atLiveLimit}
            className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending
              ? t.newEvent.submitting
              : greeting
                ? t.newEvent.submitGreeting
                : t.newEvent.submit}
          </button>
          {/* Here as well as beside the preview, because below lg: the side
              preview is hidden and this is the only way to see the result. */}
          <PreviewLink label={t.newEvent.previewOpen} hint={t.newEvent.previewOpenHint} />
        </div>
      </form>

      {/* Live preview, composed exactly like the /demo page and the real guest
          page: the invitation card with a cover, then the RSVP box under it.
          Desktop only -- on a phone this much stacked into a single column
          would push the form a screen away, and the thumbnails already carry
          the event name. The whole thing is taller than most laptop screens,
          so the sticky box scrolls on its own rather than running off the
          bottom where it could never be reached. */}
      <aside className="hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100svh-3rem)] lg:overflow-y-auto lg:pr-1 lg:pb-2">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {t.newEvent.previewLabel}
          </p>
          <PreviewLink label={t.newEvent.previewOpen} hint={t.newEvent.previewOpenHint} compact />
        </div>
        <div className="flex flex-col items-center gap-4">
          <InvitationCard
            eventName={previewName}
            eventType={eventType}
            kind={kind}
            senderName={details.senderName || null}
            eventDate={details.date}
            eventTime={greeting ? null : details.time || null}
            location={greeting ? null : details.location || null}
            description={details.description || null}
            // The built-in background shows only while there is no image at
            // all: gallery links alone are already a real cover.
            photoUrl={
              photoUrl ?? (previewGallery.length > 0 ? null : coverBackgroundUrl(coverBackground, eventType, coverLayout, coverIcon))
            }
            gallery={previewGallery}
            coverLayout={coverLayout}
            // Shown only once it is a link the server would accept, so a
            // half-typed address does not flash a dead button.
            mapLink={greeting ? null : previewMapLink(details.mapLink)}
            calendarUrl={
              greeting
                ? null
                : buildGoogleCalendarUrl({
                    title: previewName,
                    date: details.date,
                    time: details.time,
                    location: details.location,
                    description: details.description,
                  })
            }
            calendarLabel={t.invite.addToCalendar}
            templateId={templateId}
            // Same pairing as the real guest page: extras on when unlocked,
            // watermark still shown because nothing has been paid for.
            isPaid={unlocked}
            showWatermark
            theme={{ effect }}
            mapLinkLabel={t.invite.viewMap}
            watermarkText={t.invite.watermark}
            countdownLabels={countdownLabelsFrom(t)}
          />
          {!greeting && <DemoRsvpWidget />}
        </div>
      </aside>
    </div>
  );
}

// A real link (not a button calling window.open) so middle-click and "open in
// new tab" behave as expected. It needs no click handler: the draft it shows
// is already in localStorage, kept current by the effect in the form.
function PreviewLink({ label, hint, compact = false }: { label: string; hint: string; compact?: boolean }) {
  return (
    <a
      href="/preview"
      target="_blank"
      rel="noopener"
      title={hint}
      className={
        compact
          ? "text-xs font-medium text-zinc-700 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
          : "rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
      }
    >
      {label}
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}

const choiceClass =
  "flex cursor-pointer flex-col gap-1 rounded-xl border border-zinc-300 px-4 py-3 text-sm has-checked:border-zinc-900 has-checked:ring-1 has-checked:ring-zinc-900 has-focus-visible:ring-2 has-focus-visible:ring-zinc-500 dark:border-zinc-700 dark:has-checked:border-zinc-50 dark:has-checked:ring-zinc-50";

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

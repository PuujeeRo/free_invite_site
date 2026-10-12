import Image from "next/image";
import { getTemplate } from "@/lib/templates";
import { buildGreeting, buildGreetingCardLine } from "@/lib/greeting";
import { formatEventDate } from "@/lib/format";
import type { CoverLayout, EventKind, EventType } from "@/lib/supabase/types";
import type { EventTheme, EventCustomText } from "@/lib/theme";
import { CountdownTimer, type CountdownLabels } from "./CountdownTimer";
import { Ornament } from "./Ornament";
import { CoverSlider } from "./CoverSlider";
import { CardEffectLayer } from "./CardEffect";
import { DEFAULT_CARD_EFFECT, parseCardEffect } from "@/lib/theme";

export interface InvitationCardProps {
  eventName: string;
  eventType: EventType;
  // "greeting" swaps the "you are invited to..." line for an occasion label and
  // adds a "from" signature under the message. Everything else is shared.
  kind?: EventKind;
  senderName?: string | null;
  eventDate: string;
  eventTime: string | null;
  location: string | null;
  description: string | null;
  photoUrl: string | null;
  // Cover placement: above the text (default), below it, or behind it as the
  // whole card background. Ignored when there is no cover.
  coverLayout?: CoverLayout;
  // Extra images, shown after the cover as a swipeable slider. External links
  // (see lib/gallery.ts); with no uploaded cover the first of these leads.
  gallery?: string[];
  templateId: string;
  isPaid: boolean;
  guestFirstName?: string | null;
  guestLastName?: string | null;
  countdownEnabled?: boolean;
  mapLink?: string | null;
  mapLinkLabel: string;
  // "Add to Google Calendar" link (see lib/calendar.ts). Both optional: a
  // caller with no date yet, or rendering a greeting, simply omits them.
  calendarUrl?: string | null;
  calendarLabel?: string;
  // `isPaid` switches on the extra features. The watermark normally goes with
  // it, but not always: while the extras are open to everyone the watermark
  // still stays on unpaid events, so a caller can state it separately.
  showWatermark?: boolean;
  // Extra classes for the card itself, for a caller that needs to size it
  // against its surroundings (the landing hero matches it to the screen).
  className?: string;
  watermarkText: string;
  countdownLabels: CountdownLabels;
  videoUrl?: string | null;
  theme?: EventTheme;
  customText?: EventCustomText;
}

export function InvitationCard({
  eventName,
  eventType,
  kind = "invitation",
  senderName,
  eventDate,
  eventTime,
  location,
  description,
  photoUrl,
  coverLayout = "top",
  gallery,
  templateId,
  isPaid,
  guestFirstName,
  guestLastName,
  countdownEnabled,
  mapLink,
  mapLinkLabel,
  calendarUrl,
  calendarLabel,
  showWatermark,
  className = "",
  watermarkText,
  countdownLabels,
  videoUrl,
  theme,
  customText,
}: InvitationCardProps) {
  const template = getTemplate(templateId);
  const greeting =
    (isPaid && customText?.greetingOverride) ||
    (kind === "greeting"
      ? buildGreetingCardLine(eventType)
      : buildGreeting({ eventName, eventType, guestFirstName, guestLastName }));

  // Where the cover sits. Without a cover there is nothing to place, so the
  // card is laid out as "top" whatever was chosen.
  const slides = [photoUrl, ...(gallery ?? [])].filter((src): src is string => Boolean(src));
  const cover =
    slides.length > 1 ? (
      <CoverSlider slides={slides} alt={eventName} />
    ) : slides.length === 1 ? (
      <Image src={slides[0]} alt={eventName} fill className="object-cover" unoptimized />
    ) : null;
  const layout: CoverLayout = cover ? coverLayout : "top";
  const full = layout === "full";

  // Paid-only accent color override: arbitrary user hex can't be a static
  // Tailwind class (nothing to scan at build time), so it's an inline style
  // that wins over the template's default accent class.
  const paidAccentStyle = isPaid && theme?.accentColor ? { color: theme.accentColor } : undefined;

  // With the photo as the whole background, the template's own inks stop
  // being safe: they were chosen against that template's paper, and a photo
  // can be any colour under them. So "full" swaps every ink for white over a
  // dark scrim, for all templates alike -- including the paid accent, since an
  // arbitrary user colour has the same problem.
  const accentStyle = full ? undefined : paidAccentStyle;
  const accentClass = full ? "text-white/85" : accentStyle ? "" : template.accent;
  const textClass = full ? "text-white" : template.textOnGradient;
  const dividerClass = full ? "bg-white/40" : template.divider;
  const frameClass = full ? "border-white/30" : template.frameBorder;
  const chipClass = full ? "bg-white/15" : template.chip;

  // An extra like the accent colour, so it follows the same switch.
  const effect = isPaid ? parseCardEffect(theme?.effect) : DEFAULT_CARD_EFFECT;

  const headingClass = template.uppercaseName
    ? "text-xl font-semibold uppercase tracking-[0.18em] sm:text-2xl"
    : template.display === "serif"
      ? "font-display text-2xl font-medium tracking-tight sm:text-4xl"
      : "text-2xl font-semibold tracking-tight sm:text-3xl";

  // The free-plan watermark badge is pinned to the bottom-right corner. When
  // the text block is what ends up down there, it needs extra bottom padding
  // to give the badge a band of its own -- otherwise the badge lands on the
  // last line of text whenever the card is short, covering the heading. With
  // the cover at the bottom the badge sits on the photo and needs no room.
  const watermarked = showWatermark ?? !isPaid;
  const badgeOverText = watermarked && layout !== "bottom";

  return (
    <article
      // flex column so the cover can be moved below the text with `order`, and
      // so "full" can pin the text to the bottom of a card taller than it.
      className={`animate-fade-in-up relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-gradient-to-br shadow-[0_8px_40px_-12px_rgba(0,0,0,0.35)] sm:rounded-3xl ${template.gradient} ${
        full ? "min-h-[30rem] justify-end sm:min-h-[34rem]" : ""
      } ${className}`}
    >
      {full && cover && (
        <div className="absolute inset-0">
          {cover}
          {/* Scrim: darkest where the text sits, nearly clear at the top so
              the photo still reads as a photo. pointer-events-none so it does
              not swallow swipes and taps meant for a slider underneath. */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/10" />
        </div>
      )}

      {/* Sits above the cover and below the text block, so particles never
          cover the wording. That ordering is stated with z-index on the text
          block and the watermark rather than left to markup order: every
          particle is an animated (transformed) element and therefore its own
          stacking context, and relying on source order alone let confetti
          paint over the greeting line. */}
      <CardEffectLayer effect={effect} accentClass={accentClass} accentStyle={accentStyle} />

      {!full && cover && (
        <div className={`relative aspect-4/3 w-full ${layout === "bottom" ? "order-last" : ""}`}>
          {cover}
          {/* vignette on the edge that meets the text, so the photo melts
              into the card instead of ending on a hard seam */}
          <div
            className={
              layout === "bottom"
                ? "pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-black/25 to-transparent"
                : "pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/25 to-transparent"
            }
          />
        </div>
      )}

      {isPaid && videoUrl && <video src={videoUrl} controls className="w-full" />}

      {/* inset "card within a card" frame -- the classic printed-invitation cue */}
      <div
        className={`pointer-events-none absolute inset-2 rounded-xl border sm:inset-3 sm:rounded-2xl ${frameClass}`}
      />

      <div
        className={`relative z-[1] flex flex-col items-center gap-2.5 px-4 pt-8 text-center sm:gap-3 sm:px-8 sm:pt-10 ${
          badgeOverText ? "pb-14 sm:pb-16" : "pb-8 sm:pb-10"
        }`}
      >
        <p
          className={`animate-fade-in-up text-xs font-medium text-balance [animation-delay:120ms] sm:text-sm ${accentClass}`}
          style={accentStyle}
        >
          {greeting}
        </p>

        <div className={`animate-fade-in-up [animation-delay:200ms] ${accentClass}`} style={accentStyle}>
          <Ornament motif={template.ornament} />
        </div>

        <h1
          className={`animate-fade-in-up text-balance [animation-delay:280ms] ${headingClass} ${textClass}`}
        >
          {eventName}
        </h1>

        <p
          className={`animate-fade-in-up text-sm text-balance [animation-delay:360ms] sm:text-base ${textClass}`}
        >
          {formatEventDate(eventDate, eventTime)}
        </p>

        {location && (
          <p
            className={`animate-fade-in-up text-xs text-balance opacity-80 [animation-delay:440ms] sm:text-sm ${textClass}`}
          >
            📍 {location}
          </p>
        )}

        {description && (
          <>
            <div className={`animate-fade-in-up mt-1 h-px w-12 [animation-delay:500ms] ${dividerClass}`} />
            <p
              className={`animate-fade-in-up max-w-sm text-xs text-pretty whitespace-pre-line opacity-90 [animation-delay:520ms] sm:text-sm ${textClass}`}
            >
              {description}
            </p>
          </>
        )}

        {kind === "greeting" && senderName && (
          <p
            className={`animate-fade-in-up mt-1 text-xs font-medium [animation-delay:560ms] sm:text-sm ${accentClass}`}
            style={accentStyle}
          >
            — {senderName}
          </p>
        )}

        {isPaid && countdownEnabled && (
          <div className="animate-fade-in-up mt-2 w-full [animation-delay:600ms]">
            <CountdownTimer
              eventDate={eventDate}
              eventTime={eventTime}
              labels={countdownLabels}
              textClassName={textClass}
              chipClassName={chipClass}
            />
          </div>
        )}

        {/* Neither link is gated on isPaid here: whether an event may show a
            map link is the caller's decision, and a caller that should not
            show one passes null. */}
        {(mapLink || (calendarUrl && calendarLabel)) && (
          <div className="animate-fade-in-up mt-2 flex flex-wrap items-center justify-center gap-2 [animation-delay:680ms]">
            {mapLink && (
              <a
                href={mapLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-full border border-current px-4 py-2 text-xs font-medium transition-opacity hover:opacity-70 sm:text-sm ${accentClass}`}
                style={accentStyle}
              >
                {mapLinkLabel}
              </a>
            )}
            {calendarUrl && calendarLabel && (
              <a
                href={calendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-full border border-current px-4 py-2 text-xs font-medium transition-opacity hover:opacity-70 sm:text-sm ${accentClass}`}
                style={accentStyle}
              >
                {calendarLabel}
              </a>
            )}
          </div>
        )}
      </div>

      {watermarked && (
        <div className="absolute right-2 bottom-2 z-[2] rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm sm:right-3 sm:bottom-3 sm:px-3 sm:py-1 sm:text-xs">
          {watermarkText}
        </div>
      )}
    </article>
  );
}

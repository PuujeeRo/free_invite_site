import Link from "next/link";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import { TopControls } from "@/components/theme/TopControls";
import { AccountButton } from "@/components/account/AccountButton";
import { Logo } from "@/components/brand/Logo";
import { HeaderRow } from "@/components/layout/HeaderRow";
import { InvitationCard } from "@/components/templates/InvitationCard";
import { countdownLabelsFrom } from "@/lib/countdown-labels";
import { SAMPLE_EVENTS, demoTallCoverDataUri, demoEventDate } from "@/lib/demo-data";
import { TEMPLATES } from "@/lib/templates";
import { EVENT_TYPES, EXPIRED_GRACE_DAYS, MAX_LIVE_INVITATIONS, PAYMENTS_ENABLED } from "@/lib/event-types";
import { buildGoogleCalendarUrl } from "@/lib/calendar";
import { HeroCardDeck } from "@/components/templates/HeroCardDeck";
import type { CardEffect } from "@/lib/theme";
import {
  CalendarPlusIcon,
  EnvelopeSimpleOpenIcon,
  ImagesIcon,
  MapPinIcon,
  SparkleIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";

// Vertical stagger for the three steps at md and up. Literal class names (not
// interpolated) so Tailwind's scanner emits them, and md-prefixed so the
// mobile layout stays a plain single column.
const STEP_OFFSET = ["", "md:mt-10", "md:mt-20"] as const;

export default async function Home() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  // Show the product itself in the hero rather than describing it -- reuses the
  // same card component and sample data the /demo page uses. A second, smaller
  // card peeks out from behind the first (see the hero markup below) purely to
  // hint at template variety -- decorative only, not a full render of it.
  // The hero leads with a New Year party rather than the wedding every
  // invitation site opens on; the card peeking out behind it is a different
  // occasion again.
  const sampleById = (id: string) => SAMPLE_EVENTS.find((sample) => sample.id === id) ?? SAMPLE_EVENTS[0];
  // The deck in the hero, in the order it plays. The automatic greeting
  // splices the event's name and its category together, which for the New Year
  // card would say "New Year" twice, so that one carries its own line.
  const heroDeck: {
    sample: (typeof SAMPLE_EVENTS)[number];
    colors: [string, string];
    effect: CardEffect;
    greeting?: string;
  }[] = [
    { sample: sampleById("new_year"), colors: ["#24507a", "#0d2a23"], effect: "snow", greeting: t.landing.heroCardGreeting },
    { sample: sampleById("tsagaan_sar"), colors: ["#e9c77c", "#8f4f2a"], effect: "sparkle" },
    { sample: sampleById("wedding"), colors: ["#e7b9b3", "#7c4352"], effect: "hearts" },
  ];
  const heroBehind = sampleById("anniversary");
  const { date, time } = demoEventDate(21);
  const behindDate = demoEventDate(45);

  // "From 999₮" is only true while there is something to buy; otherwise the
  // third chip just says the product is free.
  // The count is read from the catalogue so the copy cannot drift from it.
  const templateCount = String(TEMPLATES.length);
  const features = [
    { Icon: UsersThreeIcon, title: t.landing.featureRsvpTitle, body: t.landing.featureRsvpBody },
    { Icon: MapPinIcon, title: t.landing.featureMapTitle, body: t.landing.featureMapBody },
    { Icon: CalendarPlusIcon, title: t.landing.featureCalendarTitle, body: t.landing.featureCalendarBody },
    { Icon: ImagesIcon, title: t.landing.featureSliderTitle, body: t.landing.featureSliderBody },
    { Icon: SparkleIcon, title: t.landing.featureEffectTitle, body: t.landing.featureEffectBody },
    { Icon: EnvelopeSimpleOpenIcon, title: t.landing.featureGreetingTitle, body: t.landing.featureGreetingBody },
  ];

  // The sample greeting in the closing band.
  const closing = sampleById("baby_shower");
  const trustChips = [
    t.landing.trustTemplates.replace("{count}", templateCount),
    t.landing.trustMessenger,
    PAYMENTS_ENABLED ? t.landing.trustPrice : t.landing.planFree,
  ];

  // The rules of the free service, said once and plainly. The numbers come
  // from the same constants the database checks are tested against, so this
  // text cannot promise something the product does not do.
  const fill = (text: string) =>
    text.replace("{live}", String(MAX_LIVE_INVITATIONS)).replace("{grace}", String(EXPIRED_GRACE_DAYS));
  const rules = [
    { title: t.landing.ruleGuestsTitle, body: t.landing.ruleGuestsBody },
    { title: t.landing.ruleSignInTitle, body: t.landing.ruleSignInBody },
    { title: fill(t.landing.ruleLiveTitle), body: fill(t.landing.ruleLiveBody) },
    { title: t.landing.ruleLifetimeTitle, body: fill(t.landing.ruleLifetimeBody) },
    { title: t.landing.ruleEmailTitle, body: t.landing.ruleEmailBody },
    { title: t.landing.ruleTipsTitle, body: t.landing.ruleTipsBody, href: "/tip", linkLabel: t.tip.navLabel },
  ];

  const steps = [
    { n: "1", title: t.landing.step1Title, body: t.landing.step1Body },
    { n: "2", title: t.landing.step2Title, body: t.landing.step2Body },
    { n: "3", title: t.landing.step3Title, body: t.landing.step3Body },
  ];

  // The paid column carries its own labels because a green check has to read as
  // "you get this". On the watermark row the paid value is "none", so a check
  // beside the plain label "Watermark" scans as watermark INCLUDED -- the exact
  // opposite of the truth. That row states the benefit instead ("No watermark")
  // and drops its value line, since the label already says it.
  const pricingRows = [
    {
      label: t.landing.featureWatermark,
      free: t.landing.valueYes,
      paidLabel: t.landing.featureNoWatermark,
      paid: null,
    },
    {
      label: t.landing.featureGuestLimit,
      free: t.landing.valueByType,
      paidLabel: t.landing.featureGuestLimit,
      paid: t.landing.valueUnlimited,
    },
    {
      label: t.landing.featureDesign,
      free: t.landing.valueNo,
      paidLabel: t.landing.featureDesign,
      paid: t.landing.valueYes,
    },
    {
      label: t.landing.featureExtras,
      free: t.landing.valueNo,
      paidLabel: t.landing.featureExtras,
      paid: t.landing.valueYes,
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      {/* Header + hero together are the "first screen": from lg: up they're
          wrapped in a min-h-svh column so the hero fills exactly one viewport
          on load with nothing cut off. Below lg: the layout stacks (text above
          card) and is genuinely taller than a phone screen, so it's left to
          flow and scroll normally rather than being crushed to fit. */}
      <div className="flex flex-col lg:min-h-svh">
        <header className="px-4 py-4 sm:px-6">
          <HeaderRow maxWidth="3xl">
            <Logo markClassName="h-5 w-5" textClassName="text-base sm:text-lg" />
            <div className="flex items-center gap-2">
              <TopControls />
              <AccountButton />
            </div>
          </HeaderRow>
        </header>

        {/* Hero. Asymmetric split: message left, the product itself right.
            The tint is amber in BOTH themes and fades to transparent rather than
            to a colour of its own, so it never bands against the page background
            and the accent hue does not change between light and dark.
            The lg: flex/padding classes are what make header + hero fill exactly
            one viewport (see the wrapper above and the card sizing below). */}
        <section className="relative overflow-hidden bg-gradient-to-b from-amber-100/50 to-transparent px-4 pt-6 pb-16 sm:px-6 sm:pt-10 lg:flex lg:flex-1 lg:items-center lg:pt-3 lg:pb-3 dark:from-amber-950/25">
        {/* Large-display tier, from 1800px wide. On a big monitor the hero
            still fills the whole screen, but its contents were sized for a
            laptop and ended up small and adrift in it. From 1800px the text
            steps up and (below) the card is enlarged to match.
            Where two sizes of the SAME property meet (the heading and the
            subtitle), the smaller one is capped with max-[1800px] so the two
            ranges never overlap: an earlier attempt that relied on stylesheet
            order to pick between two matching min-width rules lost that fight
            under the dev server. */}
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16 min-[1800px]:max-w-[100rem]">
          <div className="flex max-w-xl flex-col items-center text-center lg:items-start lg:text-left min-[1800px]:max-w-3xl">
            <h1 className="font-display text-3xl font-medium text-balance text-zinc-900 max-[1800px]:sm:text-5xl min-[1800px]:text-7xl dark:text-zinc-50">
              {t.landing.title}
            </h1>
            <p className="mt-4 max-w-md text-base text-pretty text-zinc-600 max-[1800px]:sm:text-lg min-[1800px]:mt-6 min-[1800px]:max-w-xl min-[1800px]:text-2xl dark:text-zinc-400">
              {t.landing.subtitle}
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <Link
                href="/create"
                className="w-full rounded-full bg-zinc-900 px-6 py-3 text-center text-sm font-medium text-white transition-transform visited:text-white hover:bg-zinc-700 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto dark:bg-zinc-50 dark:text-zinc-900 dark:visited:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100"
              >
                {t.landing.cta}
              </Link>
              <Link
                href="/demo"
                className="w-full rounded-full border border-zinc-300 px-6 py-3 text-center text-sm font-medium text-zinc-700 transition-transform visited:text-zinc-700 hover:border-zinc-500 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto dark:border-zinc-700 dark:text-zinc-300 dark:visited:text-zinc-300 dark:hover:border-zinc-500 dark:focus-visible:ring-zinc-100"
              >
                {t.landing.demoCta}
              </Link>
            </div>

            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
              {trustChips.map((chip) => (
                <li
                  key={chip}
                  className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-500"
                >
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-500">
                    <path
                      fill="currentColor"
                      d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
                    />
                  </svg>
                  {chip}
                </li>
              ))}
            </ul>
          </div>

          {/* a second, smaller card peeks out from behind -- purely decorative,
              hints at template variety and gives the hero real depth instead of
              one flat card floating in empty space.
              Rightward peek only from sm: up, confirmed by measurement (not
              assumed): below 640px this wrapper's max-w-md exceeds the
              available width, so it fills 100% of the space with ZERO
              horizontal slack on either side -- in that exact situation ANY
              positive right offset here immediately overshoots the section's
              overflow-hidden edge and gets clipped (measured 6-10px of clipping
              at 430px down to 280px before this fix). From sm: up, max-w-md is
              narrower than the available row width, so flex's items-center
              centers this wrapper with real slack on both sides, and the peek
              is safe. The top offset stays unconditional -- the vertical gap
              between the text block and this wrapper never went to zero at any
              tested width, so it never clipped. */}
          {/* From lg: up the card's width is driven by available viewport
              HEIGHT, not just width -- this is what actually fixes the hero
              overflowing.
              The coefficients below are MEASURED, not modelled. The obvious
              model (height = 0.75*width photo + fixed text block) is wrong and
              wildly over-shrinks: narrowing the card makes its text wrap more,
              which adds back most of the height the photo lost. Measured
              heights at 1536x800: 288w->678h, 352w->688h, 400w->702h,
              448w->739h -- i.e. a 36% width cut buys only 8% height. Only the
              400..448 region has real slope (~0.77px height per px width), so
              that region is what the linear term is fitted to; below ~400 the
              curve goes nearly flat and narrowing stops being worth it, which
              is what the 18rem floor encodes.
              The constant carries a deliberate ~10px of slack rather than
              solving for an exact fit -- an exact fit is fragile, since the
              measured curve shifts a little with locale and font loading.
              Stated in rem, not px, so it holds under a non-16px root font as
              well as under OS display scaling. Capped at 28rem (max-w-md, the
              natural size, reached once the viewport is ~838px tall). */}
          {/* On a large display (1800px wide AND 1000px tall) the whole card
              stack is enlarged by a quarter with `zoom`. zoom, unlike a
              transform, scales the box the layout sees, so the row still
              centres and spaces around the bigger card. The height condition
              keeps it off wide-but-short windows, where the enlarged card
              (about 700px) would no longer fit the one-screen hero. */}
          {/* Below sm: the stack is inset by 1rem a side. A tilted card is wider
              than its own box (by about its height times the sine of the tilt),
              and at full width on a phone that pushed its corners past the
              screen edge, where the section clips them. */}
          {/* --hero-zoom carries the enlargement factor so the card's height
              rule further down can divide by it: lengths inside a zoomed
              element are themselves scaled, so "the screen height" has to be
              asked for at 1/zoom to come out as the screen height. */}
          <div className="relative w-full max-w-md shrink-0 max-sm:w-[calc(100%-2rem)] [zoom:var(--hero-zoom)] [--hero-zoom:1] lg:max-w-[min(28rem,max(18rem,calc(129.87svh_-_40rem)))] [@media(min-width:1800px)_and_(min-height:1000px)]:[--hero-zoom:1.25]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-3 right-0 w-[88%] rotate-6 opacity-95 select-none sm:-right-3"
            >
              <InvitationCard
                eventName={heroBehind.name}
                eventType={heroBehind.eventType}
                eventDate={behindDate.date}
                eventTime={behindDate.time}
                location={heroBehind.location}
                description={null}
                photoUrl={null}
                templateId={heroBehind.defaultTemplateId}
                isPaid={false}
                mapLinkLabel={t.invite.viewMap}
                watermarkText={t.invite.watermark}
                countdownLabels={countdownLabelsFrom(t)}
              />
            </div>

            <div className="animate-drift relative -rotate-2">
              {/* Three invitations taking turns. Each is the current kind of
                  card: the cover as the whole background, an effect running,
                  the countdown, and the map and calendar buttons guests get.
                  No description on them: with the countdown and two buttons
                  the text block is already tall, and one more paragraph pushed
                  its first line up over the cover's emoji.
                  All three share one height rule, so the deck does not change
                  size as it rotates: from lg: up the card follows the screen
                  (viewport minus the header, the hero's padding and room for
                  the tilt), up to 46rem. A full-background card otherwise
                  stops at a fixed 34rem, which left it short and adrift in a
                  hero that is itself a full screen tall. */}
              <HeroCardDeck
                labels={heroDeck.map(({ sample }) => sample.name)}
                cards={heroDeck.map(({ sample, colors, effect, greeting }) => (
                  <InvitationCard
                    key={sample.id}
                    eventName={sample.name}
                    eventType={sample.eventType}
                    eventDate={date}
                    eventTime={time}
                    location={sample.location}
                    description={null}
                    photoUrl={demoTallCoverDataUri(sample.photoEmoji, colors, { y: 20, size: 120 })}
                    className="lg:min-h-[min(calc((100svh_-_7.5rem)/var(--hero-zoom)),46rem)]"
                    coverLayout="full"
                    theme={{ effect }}
                    customText={greeting ? { greetingOverride: greeting } : undefined}
                    templateId={sample.defaultTemplateId}
                    isPaid
                    countdownEnabled
                    mapLink="https://www.openstreetmap.org/?mlat=47.9185&mlon=106.9177#map=17/47.9185/106.9177"
                    calendarUrl={buildGoogleCalendarUrl({
                      title: sample.name,
                      date,
                      time,
                      location: sample.location,
                      description: sample.description,
                    })}
                    calendarLabel={t.invite.addToCalendar}
                    mapLinkLabel={t.invite.viewMap}
                    watermarkText={t.invite.watermark}
                    countdownLabels={countdownLabelsFrom(t)}
                  />
                ))}
              />
            </div>
          </div>
        </div>
        </section>
      </div>

      {/* How it works. Three steps, but deliberately not three identical
          columns: each step sits lower than the one before it on desktop, so
          the eye reads them as a sequence rather than scanning them as a menu
          of equal options. No boxes: the numbers and the spacing carry it. */}
      <section className="reveal px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((step, i) => (
              <li
                key={step.n}
                className={`relative flex flex-col items-center text-center md:items-start md:text-left ${STEP_OFFSET[i]}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900">
                  {step.n}
                </span>
                <h2 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {step.title}
                </h2>
                <p className="mt-1.5 max-w-[34ch] text-sm text-pretty text-zinc-600 dark:text-zinc-400">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What one invitation carries. A wide split, not a row of feature
          cards: the occasions sit on the left as a loose cloud of labels, the
          capabilities on the right as a plain two-column list with no boxes
          around them. Nothing here is elevated above anything else, so nothing
          needs a card. */}
      <section className="reveal border-t border-zinc-200 px-4 py-16 sm:px-6 sm:py-24 dark:border-zinc-800">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <div>
            <h2 className="font-display text-2xl font-medium tracking-tight text-balance text-zinc-900 sm:text-4xl dark:text-zinc-50">
              {t.landing.featuresTitle}
            </h2>
            <p className="mt-3 max-w-[44ch] text-sm text-pretty text-zinc-600 sm:text-base dark:text-zinc-400">
              {t.landing.featuresSubtitle}
            </p>
            <ul className="mt-8 flex flex-wrap gap-2">
              {EVENT_TYPES.filter((type) => type.id !== "other").map((type) => (
                <li
                  key={type.id}
                  className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
                >
                  {locale === "mn" ? type.labelMn : type.label}
                </li>
              ))}
            </ul>
          </div>

          <dl className="grid gap-x-12 gap-y-9 sm:grid-cols-2">
            {features.map(({ Icon, title, body }) => (
              <div key={title} className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
                <dt className="flex items-center gap-2.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-500" />
                  {title}
                </dt>
                <dd className="mt-2 max-w-[38ch] text-sm text-pretty text-zinc-600 dark:text-zinc-400">{body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* How the free service works. Takes the place of the pricing section
          while there is nothing to buy: a visitor still wants to know what the
          catch is, and the honest answer is a short list of rules. A numbered
          list in two columns rather than six cards -- these are terms to read,
          not features to browse. */}
      {!PAYMENTS_ENABLED && (
        <section className="reveal border-t border-zinc-200 px-4 py-16 sm:px-6 sm:py-20 dark:border-zinc-800">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display text-2xl font-medium tracking-tight text-balance text-zinc-900 sm:text-4xl dark:text-zinc-50">
              {t.landing.rulesTitle}
            </h2>
            <p className="mt-3 max-w-[56ch] text-sm text-pretty text-zinc-600 sm:text-base dark:text-zinc-400">
              {t.landing.rulesSubtitle}
            </p>
            <ol className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
              {rules.map((rule, i) => (
                <li key={rule.title} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="font-display w-5 shrink-0 text-2xl leading-none font-medium text-amber-700 tabular-nums dark:text-amber-500"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{rule.title}</h3>
                    <p className="mt-1 max-w-[44ch] text-sm text-pretty text-zinc-600 dark:text-zinc-400">
                      {rule.body}
                    </p>
                    {rule.href && (
                      <Link
                        href={rule.href}
                        className="mt-2 inline-block text-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
                      >
                        {rule.linkLabel}
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Pricing. Hidden while PAYMENTS_ENABLED is false (see lib/event-types):
          there is nothing to buy, so a free-vs-paid comparison would advertise
          a plan nobody can reach. */}
      {PAYMENTS_ENABLED && (
      <section className="reveal border-t border-zinc-200 px-4 py-16 sm:px-6 sm:py-20 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-center text-2xl font-medium text-zinc-900 sm:text-3xl dark:text-zinc-50">
            {t.landing.pricingTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-sm text-pretty text-zinc-600 sm:text-base dark:text-zinc-400">
            {t.landing.pricingSubtitle}
          </p>

          {/* Two plan cards rather than the 3-column comparison grid this used
              to be: the grid forced every value into a shared row, so the free
              column read as a list of things you DON'T get, and the paid column
              carried no sense of price. Each plan now states its own price and
              owns its feature list. Same four features in the same order on
              both sides, so it still reads as a comparison scanning downward. */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5">
            {/* free */}
            <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {t.landing.planFree}
              </p>
              <p className="font-display mt-2 text-3xl font-medium text-zinc-900 dark:text-zinc-50">
                0₮
              </p>
              <p className="mt-1 text-xs text-zinc-500">{t.landing.planFreeNote}</p>

              <ul className="mt-6 flex flex-col gap-3 border-t border-zinc-100 pt-5 dark:border-zinc-800">
                {pricingRows.map((row) => (
                  <li key={row.label} className="flex items-start gap-2.5">
                    {/* a dash, not a cross: on the free plan these are limits
                        rather than outright absences (the guest cap in
                        particular is a number, not a "no") */}
                    <span
                      aria-hidden="true"
                      className="mt-2 h-px w-3 shrink-0 bg-zinc-300 dark:bg-zinc-700"
                    />
                    {/* value stacked under the label, not beside it: several of
                        these values are full phrases ("10 or 100 by event
                        type", and its longer Mongolian equivalent), which
                        squash the label badly in a half-width card */}
                    <span className="flex-1">
                      <span className="block text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
                        {row.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500">{row.free}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* paid */}
            {/* ring-1 rather than border-2 for the emphasis edge: a ring is
                painted outside the box and takes no layout space, so both cards
                keep a 1px border box and their feature lists line up exactly.
                border-2 here put the two lists 1px apart (measured). */}
            <div className="relative flex flex-col rounded-2xl border border-zinc-900 bg-white p-6 shadow-[0_8px_40px_-16px_rgba(0,0,0,0.35)] ring-1 ring-zinc-900 dark:border-zinc-50 dark:bg-zinc-900 dark:ring-zinc-50">
              <span className="absolute -top-3 left-6 rounded-full bg-zinc-900 px-3 py-1 text-[10px] font-semibold tracking-wide text-white uppercase dark:bg-zinc-50 dark:text-zinc-900">
                {t.landing.planPaidBadge}
              </span>

              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {t.landing.planPaidName}
              </p>
              <p className="font-display mt-2 text-3xl font-medium text-zinc-900 dark:text-zinc-50">
                {t.landing.planPaid}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{t.landing.planPaidNote}</p>

              <ul className="mt-6 flex flex-col gap-3 border-t border-zinc-100 pt-5 dark:border-zinc-800">
                {pricingRows.map((row) => (
                  <li key={row.label} className="flex items-start gap-2.5">
                    <svg
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500"
                    >
                      <path
                        fill="currentColor"
                        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
                      />
                    </svg>
                    <span className="flex-1">
                      <span className="block text-xs text-zinc-700 sm:text-sm dark:text-zinc-300">
                        {row.paidLabel}
                      </span>
                      {row.paid && (
                        <span className="mt-0.5 block text-xs font-medium text-zinc-900 dark:text-zinc-50">
                          {row.paid}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <Link
              href="/create"
              className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-transform visited:text-white hover:bg-zinc-700 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-zinc-50 dark:text-zinc-900 dark:visited:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100"
            >
              {t.landing.cta}
            </Link>
          </div>
        </div>
      </section>
      )}

      {/* Closing call to action. The page used to end on the three steps with
          nowhere to go next. The band reuses the hero's amber tint so the page
          closes on the colour it opened with, and the card breaks out of the
          band top and bottom for depth. That card is a greeting on a
          full-background cover with an effect running: three of the newer
          options, shown instead of described. */}
      <section className="px-4 pt-10 pb-24 sm:px-6 sm:pt-16 sm:pb-32">
        <div className="mx-auto grid max-w-6xl items-center gap-10 rounded-[2rem] bg-amber-100/60 px-6 py-12 sm:px-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16 lg:py-0 dark:bg-amber-950/25">
          <div className="lg:py-16">
            <h2 className="font-display text-3xl font-medium tracking-tight text-balance text-zinc-900 sm:text-4xl dark:text-zinc-50">
              {t.landing.closingTitle}
            </h2>
            <p className="mt-3 max-w-[46ch] text-sm text-pretty text-zinc-700 sm:text-base dark:text-zinc-300">
              {t.landing.closingBody}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/create"
                className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-transform visited:text-white hover:bg-zinc-700 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-zinc-50 dark:text-zinc-900 dark:visited:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100"
              >
                {t.landing.cta}
              </Link>
              {/* A text link, not a second outlined button: the hero already
                  uses the filled + outlined pair once. */}
              <Link
                href="/demo"
                className="text-sm font-medium text-zinc-800 underline decoration-zinc-400 underline-offset-4 transition-colors hover:decoration-zinc-900 dark:text-zinc-200 dark:decoration-zinc-600 dark:hover:decoration-zinc-100"
              >
                {t.landing.demoCta}
              </Link>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[20rem] rotate-2 lg:-my-10">
            <InvitationCard
              eventName={closing.name}
              eventType={closing.eventType}
              kind="greeting"
              senderName={t.landing.closingCardSender}
              eventDate={behindDate.date}
              eventTime={null}
              location={null}
              description={t.landing.closingCardMessage}
              photoUrl={demoTallCoverDataUri(closing.photoEmoji, ["#f0cfd2", "#9a6672"])}
              coverLayout="full"
              templateId={closing.defaultTemplateId}
              isPaid
              theme={{ effect: "sparkle" }}
              mapLinkLabel={t.invite.viewMap}
              watermarkText={t.invite.watermark}
              countdownLabels={countdownLabelsFrom(t)}
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 px-4 py-8 sm:px-6 dark:border-zinc-800">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 gap-y-4 text-sm text-zinc-600 dark:text-zinc-400">
          <Logo markClassName="h-4 w-4" textClassName="text-sm" className="text-zinc-900 dark:text-zinc-100" />
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/demo" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              {t.landing.demoCta}
            </Link>
            <Link href="/create" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              {t.landing.cta}
            </Link>
          </nav>
          <p className="text-xs">© {new Date().getFullYear()} Naashir</p>
        </div>
      </footer>

    </div>
  );
}

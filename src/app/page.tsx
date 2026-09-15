import Link from "next/link";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import { TopControls } from "@/components/theme/TopControls";
import { Logo } from "@/components/brand/Logo";
import { HeaderRow } from "@/components/layout/HeaderRow";
import { InvitationCard } from "@/components/templates/InvitationCard";
import { countdownLabelsFrom } from "@/lib/countdown-labels";
import { SAMPLE_EVENTS, demoPhotoDataUri, demoEventDate } from "@/lib/demo-data";
import { TEMPLATES } from "@/lib/templates";

export default async function Home() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  // Show the product itself in the hero rather than describing it -- reuses the
  // same card component and sample data the /demo page uses. A second, smaller
  // card peeks out from behind the first (see the hero markup below) purely to
  // hint at template variety -- decorative only, not a full render of it.
  const hero = SAMPLE_EVENTS[0];
  const heroBehind = SAMPLE_EVENTS[1];
  const { date, time } = demoEventDate(21);
  const behindDate = demoEventDate(45);

  const trustChips = [t.landing.trustTemplates, t.landing.trustMessenger, t.landing.trustPrice];

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
            <TopControls />
          </HeaderRow>
        </header>

        {/* hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-rose-50/60 via-white to-white px-4 pt-8 pb-16 sm:px-6 sm:pt-12 sm:pb-20 lg:flex lg:flex-1 lg:items-center lg:pt-3 lg:pb-3 dark:from-indigo-950/40 dark:via-black dark:to-black">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-14 lg:flex-row lg:items-center lg:justify-center">
          <div className="flex max-w-2xl flex-col items-center text-center lg:items-start lg:text-left">
            <p className="text-xs font-medium tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-500">
              {t.landing.eyebrow}
            </p>
            <h1 className="font-display mt-3 text-3xl font-medium text-balance text-zinc-900 sm:text-4xl dark:text-zinc-50">
              {t.landing.title}
            </h1>
            <p className="mt-4 max-w-md text-base text-pretty text-zinc-600 sm:text-lg dark:text-zinc-400">
              {t.landing.subtitle}
            </p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className="w-full rounded-full bg-zinc-900 px-6 py-3 text-center text-sm font-medium text-white visited:text-white transition-colors hover:bg-zinc-700 sm:w-auto dark:bg-zinc-50 dark:text-zinc-900 dark:visited:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {t.landing.cta}
              </Link>
              <Link
                href="/demo"
                className="w-full rounded-full border border-zinc-300 px-6 py-3 text-center text-sm font-medium text-zinc-700 visited:text-zinc-700 transition-colors hover:border-zinc-500 sm:w-auto dark:border-zinc-700 dark:text-zinc-300 dark:visited:text-zinc-300"
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
          <div className="relative w-full max-w-md shrink-0 lg:max-w-[min(28rem,max(18rem,calc(129.87svh_-_40rem)))]">
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
              <InvitationCard
                eventName={hero.name}
                eventType={hero.eventType}
                eventDate={date}
                eventTime={time}
                location={hero.location}
                description={hero.description}
                photoUrl={demoPhotoDataUri(hero.photoEmoji, hero.photoColors)}
                templateId={hero.defaultTemplateId}
                isPaid
                countdownEnabled
                mapLinkLabel={t.invite.viewMap}
                watermarkText={t.invite.watermark}
                countdownLabels={countdownLabelsFrom(t)}
              />
            </div>
          </div>
        </div>
        </section>
      </div>

      {/* template gallery */}
      <section className="border-t border-zinc-200 px-4 py-14 sm:px-6 dark:border-zinc-800">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="font-display text-2xl font-medium text-zinc-900 sm:text-3xl dark:text-zinc-50">
            {t.landing.templatesTitle}
          </h2>
          <p className="mt-2 text-sm text-zinc-600 sm:text-base dark:text-zinc-400">
            {t.landing.templatesSubtitle}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
            {TEMPLATES.map((template) => (
              <div
                key={template.id}
                className={`overflow-hidden rounded-xl border sm:rounded-2xl ${template.frameBorder}`}
              >
                <div className={`h-20 w-full bg-gradient-to-br sm:h-28 ${template.gradient}`} />
                <div className="bg-white px-3 py-2.5 text-left sm:px-4 sm:py-3 dark:bg-zinc-900">
                  <p className="text-xs font-medium text-zinc-900 sm:text-sm dark:text-zinc-50">
                    {template.name}
                  </p>
                  <p className="mt-0.5 hidden text-xs text-zinc-500 sm:block">{template.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="px-4 py-14 sm:px-6">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3 sm:gap-8">
          {steps.map((step) => (
            <div key={step.n} className="flex flex-col items-center text-center sm:items-start sm:text-left">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900">
                {step.n}
              </span>
              <h2 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{step.title}</h2>
              <p className="mt-1 text-sm text-pretty text-zinc-600 dark:text-zinc-400">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* pricing */}
      <section className="border-t border-zinc-200 px-4 py-14 sm:px-6 sm:py-20 dark:border-zinc-800">
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
              href="/login"
              className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white visited:text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:visited:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {t.landing.cta}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

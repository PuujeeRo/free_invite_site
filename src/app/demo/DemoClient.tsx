"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { InvitationCard } from "@/components/templates/InvitationCard";
import { DemoRsvpWidget } from "@/components/rsvp/DemoRsvpWidget";
import { TemplatePicker } from "@/components/templates/TemplatePicker";
import { EffectField } from "@/components/templates/EffectField";
import { CoverBackgroundField } from "@/components/media/CoverBackgroundField";
import { CoverIconField } from "@/components/media/CoverIconField";
import { CoverLayoutField } from "@/components/media/CoverLayoutField";
import { coverBackgroundUrl } from "@/lib/cover-backgrounds";
import { DEFAULT_CARD_EFFECT, type CardEffect, type CoverBackground } from "@/lib/theme";
import type { CoverLayout } from "@/lib/supabase/types";
import { buildGoogleCalendarUrl } from "@/lib/calendar";
import { SAMPLE_EVENTS, demoEventDate } from "@/lib/demo-data";
import { countdownLabelsFrom } from "@/lib/countdown-labels";
import { useI18n } from "@/i18n/I18nProvider";

export function DemoClient() {
  const { dict: t } = useI18n();
  const [sampleId, setSampleId] = useState(SAMPLE_EVENTS[0].id);
  const [templateId, setTemplateId] = useState(SAMPLE_EVENTS[0].defaultTemplateId);
  // With payments off the extras are simply part of every invitation, so the
  // demo shows them from the start instead of behind the (hidden) toggle.
  // The same choices, with the same controls and starting values, as the
  // new-invitation form: what a visitor tries here is what they get there.
  const [coverBackground, setCoverBackground] = useState<CoverBackground>("auto");
  const [coverIcon, setCoverIcon] = useState<string | null>(null);
  const [coverLayout, setCoverLayout] = useState<CoverLayout>("top");
  const [effect, setEffect] = useState<CardEffect>(DEFAULT_CARD_EFFECT);

  const sample = SAMPLE_EVENTS.find((s) => s.id === sampleId) ?? SAMPLE_EVENTS[0];
  const { date, time } = useMemo(() => demoEventDate(21), []);

  function selectSample(id: string) {
    setSampleId(id);
    const next = SAMPLE_EVENTS.find((s) => s.id === id);
    if (next) setTemplateId(next.defaultTemplateId);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center px-3 pb-16 sm:px-4">
      <h1 className="font-display mt-4 text-center text-2xl font-medium text-balance text-zinc-900 sm:text-3xl dark:text-zinc-50">
        {t.demo.title}
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-pretty text-zinc-600 dark:text-zinc-400">
        {t.demo.subtitle}
      </p>

      <div className="mt-6 flex w-full flex-col items-center gap-6 sm:mt-8 lg:flex-row lg:items-start lg:justify-center">
        <div className="flex w-full max-w-md flex-col items-center gap-4 sm:gap-6">
          <InvitationCard
            eventName={sample.name}
            eventType={sample.eventType}
            eventDate={date}
            eventTime={time}
            location={sample.location}
            description={sample.description}
            photoUrl={coverBackgroundUrl(coverBackground, sample.eventType, coverLayout, coverIcon)}
            coverLayout={coverLayout}
            templateId={templateId}
            isPaid
            showWatermark
            calendarUrl={buildGoogleCalendarUrl({
              title: sample.name,
              date,
              time,
              location: sample.location,
              description: sample.description,
            })}
            calendarLabel={t.invite.addToCalendar}
            countdownEnabled
            mapLink="https://maps.google.com"
            mapLinkLabel={t.invite.viewMap}
            watermarkText={t.invite.watermark}
            // The accent override is a choice an organizer makes, not a
            // default, so it is only demonstrated by the paid toggle.
            theme={{ effect }}
            countdownLabels={countdownLabelsFrom(t)}
          />
          <DemoRsvpWidget />
        </div>

        <div className="flex w-full max-w-md flex-col gap-6 lg:max-w-md">
          <div>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t.demo.sampleEventLabel}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
              {SAMPLE_EVENTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectSample(s.id)}
                  className={`rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:px-3 sm:text-xs ${
                    s.id === sampleId
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                      : "border-zinc-300 text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {s.photoEmoji} {s.name}
                </button>
              ))}
            </div>
          </div>

          <TemplatePicker
            eventType={sample.eventType}
            value={templateId}
            onChange={setTemplateId}
            previewName={sample.name}
          />

          <CoverBackgroundField eventType={sample.eventType} value={coverBackground} onChange={setCoverBackground} />
          {coverBackground !== "none" && (
            <CoverIconField eventType={sample.eventType} value={coverIcon} onChange={setCoverIcon} />
          )}
          <CoverLayoutField value={coverLayout} onChange={setCoverLayout} />

          <div>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t.newEvent.stepEffect}</p>
            <div className="mt-2">
              <EffectField value={effect} onChange={setEffect} />
            </div>
          </div>

          <Link
            href="/create"
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white visited:text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:visited:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {t.demo.cta}
          </Link>
        </div>
      </div>
    </div>
  );
}

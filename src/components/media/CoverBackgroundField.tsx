"use client";

import { COVER_BACKGROUNDS, type CoverBackground } from "@/lib/theme";
import { coverBackgroundColors } from "@/lib/cover-backgrounds";
import { sampleCoverEmoji } from "@/lib/demo-data";
import type { EventType } from "@/lib/supabase/types";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Chooses a built-in cover for an invitation without an image of its own.
 * Submits as `cover_background`. An uploaded image or gallery links take its
 * place on the card, which the hint under the swatches says. The swatch with
 * the emoji is "auto": the colours of the event's own category.
 */
export function CoverBackgroundField({
  value,
  onChange,
  eventType,
}: {
  eventType: EventType;
  value: CoverBackground;
  onChange: (background: CoverBackground) => void;
}) {
  const { dict: t } = useI18n();

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {t.newEvent.coverBackgroundLabel}
      </legend>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {COVER_BACKGROUNDS.map((background, i) => {
          const colors = coverBackgroundColors(background, eventType);
          return (
            <label
              key={background}
              className="flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-zinc-300 text-[10px] font-medium text-zinc-600 has-checked:border-zinc-900 has-checked:ring-2 has-checked:ring-zinc-900 has-focus-visible:ring-2 has-focus-visible:ring-zinc-500 dark:border-zinc-700 dark:text-zinc-400 dark:has-checked:border-zinc-50 dark:has-checked:ring-zinc-50"
              // The swatch colours come from data, so they cannot be classes.
              style={colors ? { backgroundImage: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` } : undefined}
            >
              <input
                type="radio"
                name="cover_background"
                value={background}
                checked={background === value}
                onChange={() => onChange(background)}
                aria-label={
                  background === "auto"
                    ? t.newEvent.coverBackgroundAuto
                    : colors
                      ? `${t.newEvent.coverBackgroundLabel} ${i}`
                      : t.newEvent.coverBackgroundNone
                }
                className="sr-only"
              />
              {!colors && <span aria-hidden="true">{t.newEvent.coverBackgroundNone}</span>}
              {background === "auto" && (
                <span aria-hidden="true" title={t.newEvent.coverBackgroundAuto} className="text-lg leading-none">
                  {sampleCoverEmoji(eventType)}
                </span>
              )}
            </label>
          );
        })}
      </div>
      <span className="text-xs text-zinc-500">{t.newEvent.coverBackgroundHint}</span>
    </fieldset>
  );
}

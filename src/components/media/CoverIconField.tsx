"use client";

import { COVER_ICONS } from "@/lib/theme";
import { sampleCoverEmoji } from "@/lib/demo-data";
import type { EventType } from "@/lib/supabase/types";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Chooses the emoji drawn on a built-in cover. Submits as `cover_icon`; the
 * first option submits an empty value, meaning "whatever suits the category",
 * and shows that category's emoji with a ring of dashes to set it apart.
 */
export function CoverIconField({
  value,
  onChange,
  eventType,
}: {
  eventType: EventType;
  value: string | null;
  onChange: (icon: string | null) => void;
}) {
  const { dict: t } = useI18n();
  const options: (string | null)[] = [null, ...COVER_ICONS];

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t.newEvent.coverIconLabel}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((icon) => (
          <label
            key={icon ?? "auto"}
            title={icon ? undefined : t.newEvent.coverBackgroundAuto}
            className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border text-lg leading-none has-checked:border-zinc-900 has-checked:ring-2 has-checked:ring-zinc-900 has-focus-visible:ring-2 has-focus-visible:ring-zinc-500 dark:has-checked:border-zinc-50 dark:has-checked:ring-zinc-50 ${
              icon ? "border-zinc-300 dark:border-zinc-700" : "border-dashed border-zinc-400 dark:border-zinc-500"
            }`}
          >
            <input
              type="radio"
              name="cover_icon"
              value={icon ?? ""}
              checked={icon === value}
              onChange={() => onChange(icon)}
              aria-label={icon ?? t.newEvent.coverBackgroundAuto}
              className="sr-only"
            />
            <span aria-hidden="true">{icon ?? sampleCoverEmoji(eventType)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

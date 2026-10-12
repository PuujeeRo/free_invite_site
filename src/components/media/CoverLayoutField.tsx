"use client";

import { COVER_LAYOUTS, type CoverLayout } from "@/lib/supabase/types";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Chooses where the cover sits on the card: above the text, below it, or
 * behind it as the whole background. Submits as `cover_layout`.
 *
 * Each option carries a tiny diagram of the card (shaded block = image, lines
 * = text) because "top / bottom / full background" is much quicker to read as
 * a picture than as three words, and the words alone do not say what "full"
 * does to the text.
 */
export function CoverLayoutField({
  value,
  onChange,
}: {
  value: CoverLayout;
  onChange: (layout: CoverLayout) => void;
}) {
  const { dict: t } = useI18n();
  const label: Record<CoverLayout, string> = {
    top: t.newEvent.coverLayoutTop,
    bottom: t.newEvent.coverLayoutBottom,
    full: t.newEvent.coverLayoutFull,
  };

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {t.newEvent.coverLayoutLabel}
      </legend>
      <div className="mt-1.5 grid grid-cols-3 gap-2 sm:max-w-sm">
        {COVER_LAYOUTS.map((layout) => (
          <label
            key={layout}
            className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-zinc-300 px-2 py-2.5 text-center text-xs font-medium text-zinc-700 has-checked:border-zinc-900 has-checked:text-zinc-900 has-checked:ring-1 has-checked:ring-zinc-900 has-focus-visible:ring-2 has-focus-visible:ring-zinc-500 dark:border-zinc-700 dark:text-zinc-300 dark:has-checked:border-zinc-50 dark:has-checked:text-zinc-50 dark:has-checked:ring-zinc-50"
          >
            <input
              type="radio"
              name="cover_layout"
              value={layout}
              checked={layout === value}
              onChange={() => onChange(layout)}
              className="sr-only"
            />
            <Diagram layout={layout} />
            {label[layout]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Diagram({ layout }: { layout: CoverLayout }) {
  const lines = layout === "full" ? "#ffffff" : "currentColor";
  // y of the first text line; the image block takes the other part of the card
  const textY = layout === "top" ? 21 : layout === "bottom" ? 6 : 22;
  return (
    <svg viewBox="0 0 24 32" className="h-8 w-6" aria-hidden="true">
      <rect x="0.5" y="0.5" width="23" height="31" rx="3" fill="none" stroke="currentColor" opacity="0.45" />
      {layout === "top" && <path d="M1 3.5 A2.5 2.5 0 0 1 3.5 1 H20.5 A2.5 2.5 0 0 1 23 3.5 V16 H1 Z" fill="currentColor" opacity="0.35" />}
      {layout === "bottom" && <path d="M1 16 H23 V28.5 A2.5 2.5 0 0 1 20.5 31 H3.5 A2.5 2.5 0 0 1 1 28.5 Z" fill="currentColor" opacity="0.35" />}
      {layout === "full" && <rect x="1" y="1" width="22" height="30" rx="2.5" fill="currentColor" opacity="0.6" />}
      <path
        d={`M7 ${textY} H17 M5 ${textY + 3.5} H19 M8 ${textY + 7} H16`}
        stroke={lines}
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity={layout === "full" ? 1 : 0.7}
      />
    </svg>
  );
}

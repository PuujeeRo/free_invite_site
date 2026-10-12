"use client";

import { CARD_EFFECTS, type CardEffect } from "@/lib/theme";
import { useI18n } from "@/i18n/I18nProvider";

const GLYPH: Record<CardEffect, string> = {
  sheen: "✦",
  sparkle: "✨",
  confetti: "🎊",
  snow: "❄️",
  hearts: "💗",
  petals: "🌸",
  balloons: "🎈",
  fireworks: "🎆",
  glow: "🌅",
  none: "—",
};

/** Chooses the card's animated effect. Submits as `effect`. */
export function EffectField({ value, onChange }: { value: CardEffect; onChange: (effect: CardEffect) => void }) {
  const { dict: t } = useI18n();
  const label: Record<CardEffect, string> = {
    sheen: t.newEvent.effectSheen,
    sparkle: t.newEvent.effectSparkle,
    confetti: t.newEvent.effectConfetti,
    snow: t.newEvent.effectSnow,
    hearts: t.newEvent.effectHearts,
    petals: t.newEvent.effectPetals,
    balloons: t.newEvent.effectBalloons,
    fireworks: t.newEvent.effectFireworks,
    glow: t.newEvent.effectGlow,
    none: t.newEvent.effectNone,
  };

  return (
    <fieldset>
      <legend className="sr-only">{t.newEvent.stepEffect}</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {CARD_EFFECTS.map((effect) => (
          <label
            key={effect}
            className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-zinc-300 px-2 py-2.5 text-center text-xs font-medium text-zinc-700 has-checked:border-zinc-900 has-checked:text-zinc-900 has-checked:ring-1 has-checked:ring-zinc-900 has-focus-visible:ring-2 has-focus-visible:ring-zinc-500 dark:border-zinc-700 dark:text-zinc-300 dark:has-checked:border-zinc-50 dark:has-checked:text-zinc-50 dark:has-checked:ring-zinc-50"
          >
            <input
              type="radio"
              name="effect"
              value={effect}
              checked={effect === value}
              onChange={() => onChange(effect)}
              className="sr-only"
            />
            <span aria-hidden="true" className="text-base leading-none">
              {GLYPH[effect]}
            </span>
            {label[effect]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

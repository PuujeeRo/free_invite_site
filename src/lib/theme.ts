// events.theme / events.custom_text are untyped jsonb columns -- these helpers
// keep the handful of keys we actually use in one place instead of scattering
// `as` casts across components.

// Animated overlay on the card (components/templates/CardEffect.tsx). "sheen"
// is the look every card has always had, so it is the default and is never
// written to the database -- only a deliberate other choice is stored.
export type CardEffect = "sheen" | "none" | "sparkle" | "confetti" | "snow" | "hearts";
export const CARD_EFFECTS: readonly CardEffect[] = ["sheen", "sparkle", "confetti", "snow", "hearts", "none"];
export const DEFAULT_CARD_EFFECT: CardEffect = "sheen";

export function parseCardEffect(value: unknown): CardEffect {
  return CARD_EFFECTS.includes(value as CardEffect) ? (value as CardEffect) : DEFAULT_CARD_EFFECT;
}

// A `type`, not an `interface`: this is written to a jsonb column typed as
// Record<string, unknown>, and an interface does not satisfy an index
// signature (see the note at the top of lib/supabase/types.ts).
export type EventTheme = {
  accentColor?: string; // hex override of the template's accent color
  effect?: CardEffect;
};

export interface EventCustomText {
  greetingOverride?: string; // replaces the auto-generated greeting sentence
}

export function readTheme(value: Record<string, unknown> | null | undefined): EventTheme {
  if (!value) return {};
  const theme: EventTheme = {};
  if (typeof value.accentColor === "string") theme.accentColor = value.accentColor;
  const effect = parseCardEffect(value.effect);
  if (effect !== DEFAULT_CARD_EFFECT) theme.effect = effect;
  return theme;
}

/** What to store for a theme: only the keys that differ from the defaults. */
export function buildTheme(input: { accentColor?: string | null; effect?: CardEffect }): EventTheme {
  const theme: EventTheme = {};
  if (input.accentColor) theme.accentColor = input.accentColor;
  if (input.effect && input.effect !== DEFAULT_CARD_EFFECT) theme.effect = input.effect;
  return theme;
}

export function readCustomText(value: Record<string, unknown> | null | undefined): EventCustomText {
  if (!value) return {};
  const greetingOverride = value.greetingOverride;
  return typeof greetingOverride === "string" && greetingOverride.trim()
    ? { greetingOverride }
    : {};
}

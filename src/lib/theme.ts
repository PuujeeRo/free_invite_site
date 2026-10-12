// events.theme / events.custom_text are untyped jsonb columns -- these helpers
// keep the handful of keys we actually use in one place instead of scattering
// `as` casts across components.

// Animated overlay on the card (components/templates/CardEffect.tsx). "sheen"
// is the look every card has always had, so it is the default and is never
// written to the database -- only a deliberate other choice is stored.
export type CardEffect =
  | "sheen"
  | "none"
  | "sparkle"
  | "confetti"
  | "snow"
  | "hearts"
  | "petals"
  | "balloons"
  | "fireworks"
  | "glow";
export const CARD_EFFECTS: readonly CardEffect[] = [
  "sheen",
  "sparkle",
  "confetti",
  "snow",
  "hearts",
  "petals",
  "balloons",
  "fireworks",
  "glow",
  "none",
];
export const DEFAULT_CARD_EFFECT: CardEffect = "sheen";

export function parseCardEffect(value: unknown): CardEffect {
  return CARD_EFFECTS.includes(value as CardEffect) ? (value as CardEffect) : DEFAULT_CARD_EFFECT;
}

// Built-in cover for an invitation with no image of its own (drawn by
// lib/cover-backgrounds.ts). "none" is the default and is never stored;
// "auto" takes the colours of the event's category, as the demo does.
export const COVER_BACKGROUNDS = ["none", "auto", "paper", "blush", "gold", "sky", "forest", "night", "plum"] as const;
export type CoverBackground = (typeof COVER_BACKGROUNDS)[number];

export function parseCoverBackground(value: unknown): CoverBackground {
  return COVER_BACKGROUNDS.includes(value as CoverBackground) ? (value as CoverBackground) : "none";
}

// The emoji drawn on a built-in cover. A fixed list rather than free text:
// the value is written into an SVG, so it must never be arbitrary input.
// null means "the one that suits the event's category".
export const COVER_ICONS = [
  "🎂", "🎉", "🎈", "🎁", "🎊", "🥳",
  "💍", "💐", "❤️", "🕊️", "🥂", "🍾",
  "🍼", "🧸", "✂️", "🎓", "🏫", "🏡",
  "🏢", "🎄", "🎆", "🥟", "🌸", "⭐",
  "👑", "🎵", "✉️",
] as const;

export function parseCoverIcon(value: unknown): string | null {
  return (COVER_ICONS as readonly string[]).includes(value as string) ? (value as string) : null;
}

// A `type`, not an `interface`: this is written to a jsonb column typed as
// Record<string, unknown>, and an interface does not satisfy an index
// signature (see the note at the top of lib/supabase/types.ts).
export type EventTheme = {
  accentColor?: string; // hex override of the template's accent color
  effect?: CardEffect;
  cover?: CoverBackground;
  icon?: string; // one of COVER_ICONS
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
  const cover = parseCoverBackground(value.cover);
  if (cover !== "none") theme.cover = cover;
  const icon = parseCoverIcon(value.icon);
  if (icon) theme.icon = icon;
  return theme;
}

/** What to store for a theme: only the keys that differ from the defaults. */
export function buildTheme(input: {
  accentColor?: string | null;
  effect?: CardEffect;
  cover?: CoverBackground;
  icon?: string | null;
}): EventTheme {
  const theme: EventTheme = {};
  if (input.accentColor) theme.accentColor = input.accentColor;
  if (input.effect && input.effect !== DEFAULT_CARD_EFFECT) theme.effect = input.effect;
  if (input.cover && input.cover !== "none") theme.cover = input.cover;
  if (input.icon) theme.icon = input.icon;
  return theme;
}

export function readCustomText(value: Record<string, unknown> | null | undefined): EventCustomText {
  if (!value) return {};
  const greetingOverride = value.greetingOverride;
  return typeof greetingOverride === "string" && greetingOverride.trim()
    ? { greetingOverride }
    : {};
}

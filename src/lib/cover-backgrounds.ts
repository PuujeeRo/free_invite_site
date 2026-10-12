import type { CoverLayout, EventType } from "@/lib/supabase/types";
import type { CoverBackground } from "@/lib/theme";
import { SAMPLE_EVENTS, demoPhotoDataUri, demoTallCoverDataUri, sampleCoverEmoji } from "@/lib/demo-data";

// Built-in covers for an invitation that has no image of its own: a coloured
// ground carrying the occasion's emoji. Drawn as an inline SVG, so choosing
// one stores only its id (events.theme.cover) -- nothing is uploaded.
const COLORS: Record<Exclude<CoverBackground, "none" | "auto">, [string, string]> = {
  paper: ["#f3ecdf", "#e0d3bb"],
  blush: ["#f7dfe0", "#e3b3ba"],
  gold: ["#fbf1d2", "#e2bd6f"],
  sky: ["#dcebf7", "#9dbfe0"],
  forest: ["#2f5d4a", "#12291f"],
  night: ["#24507a", "#0d1b33"],
  plum: ["#6b3a5b", "#2a1426"],
};

// "auto": the colours the demo's sample for that category uses, so a new
// invitation opens looking like the demo of the same occasion.
function categoryColors(eventType: EventType): [string, string] {
  return SAMPLE_EVENTS.find((sample) => sample.eventType === eventType)?.photoColors ?? COLORS.paper;
}

export function coverBackgroundColors(id: CoverBackground, eventType: EventType): [string, string] | null {
  if (id === "none") return null;
  return id === "auto" ? categoryColors(eventType) : COLORS[id];
}

/**
 * The image to show as the cover, or null for "none". A card that uses its
 * cover as the whole background gets the tall version, with the emoji high up
 * and clear of the text.
 */
export function coverBackgroundUrl(
  id: CoverBackground,
  eventType: EventType,
  layout: CoverLayout,
  icon?: string | null // a chosen emoji; otherwise the category's own
): string | null {
  const colors = coverBackgroundColors(id, eventType);
  if (!colors) return null;
  const emoji = icon || sampleCoverEmoji(eventType);
  return layout === "full" ? demoTallCoverDataUri(emoji, colors) : demoPhotoDataUri(emoji, colors);
}

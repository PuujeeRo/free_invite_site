import type { EventType } from "@/lib/supabase/types";

export type OrnamentMotif =
  | "floral"
  | "rings"
  | "stars"
  | "confetti"
  | "leaf"
  | "tassel"
  | "heart"
  | "sun"
  | "knot"
  | "house"
  | "diamond";

export interface Template {
  id: string;
  name: string;
  description: string;
  // Fixed free-plan palette. Paid plan can override the accent via events.theme.
  // Arbitrary hex stops rather than Tailwind's named scale on purpose: the
  // 100/200-level named colors (amber-100, sky-100, ...) all sit at roughly the
  // same high saturation, which is what made the six templates read as "bright
  // web pastel" instead of dyed cardstock -- real invitation paper is warm and
  // very low-chroma. See docs/design-notes if these ever need re-tuning.
  gradient: string; // tailwind gradient classes
  accent: string; // tailwind text color for the accent / eyebrow
  textOnGradient: string; // tailwind text color that reads on the gradient
  // Per-template personality -- these are what stop all six templates from
  // being the same card in six colors.
  display: "serif" | "sans"; // heading typeface
  ornament: OrnamentMotif; // decorative divider under the greeting
  frameBorder: string; // inset "card within a card" border color
  divider: string; // hairline rule color
  chip: string; // countdown chip background
  uppercaseName?: boolean; // tracked-out caps heading instead of a display serif
  // Event types this template is suggested for first in the picker. Purely a
  // sort hint: every template stays selectable for every event type.
  recommendedFor: EventType[];
}

// Template ids are stored in events.template_id, so an id must never be
// renamed or removed once shipped (getTemplate falls back to the first entry
// for an unknown id, which would silently restyle existing invitations).
// The first six are the original v1 set; the landing page shows only those.
// Palette is warm and
// low-chroma throughout (ivory/champagne/sage/ink rather than saturated
// pastels), body text is a warm near-black (#2b2420) rather than cool zinc-900
// on every light card, and light-card text uses whichever color is lighter --
// so the whole set reads as dyed paper stock, not colored screen gradients.
const INK = "text-[#2b2420]";
const PAPER_WHITE = "text-[#f5f1e8]";

export const TEMPLATES: Template[] = [
  {
    id: "classic",
    name: "Ivory Linen",
    description: "Warm ivory paper, works for any event.",
    gradient: "from-[#faf6ee] via-[#f6f0e2] to-[#f0e7d2]",
    accent: "text-[#a15c3e]",
    textOnGradient: INK,
    display: "serif",
    ornament: "floral",
    frameBorder: "border-[#a15c3e]/20",
    divider: "bg-[#a15c3e]/25",
    chip: "bg-white/60",
    recommendedFor: ["other", "birthday", "anniversary", "hair_cutting", "tsagaan_sar"],
  },
  {
    id: "elegant-gold",
    name: "Champagne Gold",
    description: "Antique gold on cream, for weddings and formal events.",
    gradient: "from-[#fbf4e3] via-[#f6ead0] to-[#eeddac]",
    accent: "text-[#8a6a24]",
    textOnGradient: INK,
    display: "serif",
    ornament: "rings",
    frameBorder: "border-[#8a6a24]/25",
    divider: "bg-[#8a6a24]/25",
    chip: "bg-white/65",
    recommendedFor: ["wedding", "anniversary", "engagement", "tsagaan_sar"],
  },
  {
    id: "midnight",
    name: "Ink Navy",
    description: "Deep ink navy with a modern, night-time feel.",
    gradient: "from-[#10131f] via-[#0c0e18] to-[#10131f]",
    accent: "text-[#c9b98a]",
    textOnGradient: PAPER_WHITE,
    display: "sans",
    ornament: "stars",
    frameBorder: "border-[#c9b98a]/20",
    divider: "bg-[#c9b98a]/25",
    chip: "bg-white/10",
    uppercaseName: true,
    recommendedFor: ["corporate", "reunion", "birthday", "new_year"],
  },
  {
    id: "playful-pastel",
    name: "Soft Blossom",
    description: "Dusty blush and sage -- gentle, great for kids' birthdays.",
    gradient: "from-[#fdf1ee] via-[#f7ece7] to-[#eef1e5]",
    accent: "text-[#b8677a]",
    textOnGradient: INK,
    display: "sans",
    ornament: "confetti",
    frameBorder: "border-[#b8677a]/20",
    divider: "bg-[#b8677a]/25",
    chip: "bg-white/65",
    recommendedFor: ["kids_first_birthday", "birthday", "baby_shower"],
  },
  {
    id: "botanical",
    name: "Sage Botanical",
    description: "Soft sage paper, natural and calm.",
    gradient: "from-[#f5f6ee] via-[#eef1e3] to-[#e4e9d8]",
    accent: "text-[#5f6f45]",
    textOnGradient: INK,
    display: "serif",
    ornament: "leaf",
    frameBorder: "border-[#5f6f45]/20",
    divider: "bg-[#5f6f45]/25",
    chip: "bg-white/60",
    recommendedFor: ["engagement", "housewarming", "wedding"],
  },
  {
    id: "graduation-navy",
    name: "Navy & Brass",
    description: "Navy and brushed brass, built for graduations.",
    gradient: "from-[#0e1526] via-[#0a0f1c] to-[#0e1526]",
    accent: "text-[#c9a84c]",
    textOnGradient: PAPER_WHITE,
    display: "sans",
    ornament: "tassel",
    frameBorder: "border-[#c9a84c]/25",
    divider: "bg-[#c9a84c]/25",
    chip: "bg-white/10",
    uppercaseName: true,
    recommendedFor: ["graduation", "corporate", "reunion", "new_year"],
  },
  {
    id: "rose-quartz",
    name: "Rose Quartz",
    description: "Blush paper with a single heart, for couples.",
    gradient: "from-[#fbf0ee] via-[#f6e4e1] to-[#eed3d0]",
    accent: "text-[#a8566a]",
    textOnGradient: INK,
    display: "serif",
    ornament: "heart",
    frameBorder: "border-[#a8566a]/20",
    divider: "bg-[#a8566a]/25",
    chip: "bg-white/60",
    recommendedFor: ["wedding", "engagement", "anniversary"],
  },
  {
    id: "terracotta",
    name: "Terracotta",
    description: "Sun-warmed clay tones, relaxed and homely.",
    gradient: "from-[#f8ece2] via-[#f1ddcb] to-[#e6c7ad]",
    accent: "text-[#a4522f]",
    textOnGradient: INK,
    display: "sans",
    ornament: "sun",
    frameBorder: "border-[#a4522f]/20",
    divider: "bg-[#a4522f]/25",
    chip: "bg-white/60",
    recommendedFor: ["housewarming", "birthday", "other"],
  },
  {
    id: "steppe-sky",
    name: "Steppe Sky",
    description: "Pale sky blue with a linked-diamond knot.",
    gradient: "from-[#f1f5f8] via-[#e6edf2] to-[#d6e1ea]",
    accent: "text-[#3f6184]",
    textOnGradient: INK,
    display: "serif",
    ornament: "knot",
    frameBorder: "border-[#3f6184]/20",
    divider: "bg-[#3f6184]/25",
    chip: "bg-white/60",
    recommendedFor: ["hair_cutting", "kids_first_birthday", "reunion", "tsagaan_sar"],
  },
  {
    id: "burgundy",
    name: "Burgundy Velvet",
    description: "Deep wine and gold for a formal evening.",
    gradient: "from-[#3a1420] via-[#2c0f18] to-[#3a1420]",
    accent: "text-[#d9b676]",
    textOnGradient: PAPER_WHITE,
    display: "serif",
    ornament: "rings",
    frameBorder: "border-[#d9b676]/25",
    divider: "bg-[#d9b676]/25",
    chip: "bg-white/10",
    recommendedFor: ["wedding", "anniversary", "corporate", "new_year"],
  },
  {
    id: "forest",
    name: "Forest & Brass",
    description: "Dark green with brass lettering.",
    gradient: "from-[#12281f] via-[#0d1f18] to-[#12281f]",
    accent: "text-[#c9a84c]",
    textOnGradient: PAPER_WHITE,
    display: "sans",
    ornament: "leaf",
    frameBorder: "border-[#c9a84c]/25",
    divider: "bg-[#c9a84c]/25",
    chip: "bg-white/10",
    uppercaseName: true,
    recommendedFor: ["corporate", "reunion", "graduation", "new_year"],
  },
  {
    id: "lavender",
    name: "Lavender Mist",
    description: "Soft lilac paper, light and gentle.",
    gradient: "from-[#f6f2fa] via-[#ece5f4] to-[#ddd2ea]",
    accent: "text-[#6f5596]",
    textOnGradient: INK,
    display: "serif",
    ornament: "floral",
    frameBorder: "border-[#6f5596]/20",
    divider: "bg-[#6f5596]/25",
    chip: "bg-white/60",
    recommendedFor: ["baby_shower", "birthday", "engagement"],
  },
  {
    id: "saffron",
    name: "Saffron Silk",
    description: "Golden yellow with a traditional knot.",
    gradient: "from-[#fdf3d7] via-[#f8e6b4] to-[#f0d58a]",
    accent: "text-[#9a4a1c]",
    textOnGradient: INK,
    display: "serif",
    ornament: "knot",
    frameBorder: "border-[#9a4a1c]/20",
    divider: "bg-[#9a4a1c]/25",
    chip: "bg-white/60",
    recommendedFor: ["hair_cutting", "kids_first_birthday", "other", "tsagaan_sar"],
  },
  {
    id: "charcoal",
    name: "Charcoal & Copper",
    description: "Graphite with a copper accent, modern.",
    gradient: "from-[#26262a] via-[#1c1c20] to-[#26262a]",
    accent: "text-[#d08c5b]",
    textOnGradient: PAPER_WHITE,
    display: "sans",
    ornament: "stars",
    frameBorder: "border-[#d08c5b]/25",
    divider: "bg-[#d08c5b]/25",
    chip: "bg-white/10",
    uppercaseName: true,
    recommendedFor: ["corporate", "reunion", "graduation", "birthday", "new_year"],
  },
  {
    id: "mint",
    name: "Mint Cream",
    description: "Fresh mint with confetti, bright but calm.",
    gradient: "from-[#f0f8f3] via-[#e2f1e8] to-[#cfe6d8]",
    accent: "text-[#2f7a5c]",
    textOnGradient: INK,
    display: "sans",
    ornament: "confetti",
    frameBorder: "border-[#2f7a5c]/20",
    divider: "bg-[#2f7a5c]/25",
    chip: "bg-white/60",
    recommendedFor: ["baby_shower", "kids_first_birthday", "birthday"],
  },
  {
    id: "pearl",
    name: "Pearl",
    description: "Near-white and minimal, lets the words lead.",
    gradient: "from-[#fbfbf9] via-[#f4f4f0] to-[#e9e9e3]",
    accent: "text-[#55554e]",
    textOnGradient: INK,
    display: "sans",
    ornament: "diamond",
    frameBorder: "border-[#55554e]/20",
    divider: "bg-[#55554e]/25",
    chip: "bg-white/60",
    uppercaseName: true,
    recommendedFor: ["corporate", "wedding", "graduation", "other", "tsagaan_sar"],
  },
  {
    id: "peach",
    name: "Peach Blossom",
    description: "Warm peach paper with a heart.",
    gradient: "from-[#fdf0e6] via-[#fae0cd] to-[#f3caae]",
    accent: "text-[#b0563a]",
    textOnGradient: INK,
    display: "serif",
    ornament: "heart",
    frameBorder: "border-[#b0563a]/20",
    divider: "bg-[#b0563a]/25",
    chip: "bg-white/60",
    recommendedFor: ["engagement", "baby_shower", "housewarming"],
  },
  {
    id: "hearth",
    name: "Warm Hearth",
    description: "Cream and brick red, made for a new home.",
    gradient: "from-[#f9f1e4] via-[#f2e4cd] to-[#e7d0ab]",
    accent: "text-[#8c3b2a]",
    textOnGradient: INK,
    display: "serif",
    ornament: "house",
    frameBorder: "border-[#8c3b2a]/20",
    divider: "bg-[#8c3b2a]/25",
    chip: "bg-white/60",
    recommendedFor: ["housewarming", "anniversary", "other"],
  },
];

export function getTemplate(id: string): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/** Templates suggested for an event type first, then everything else. */
export function splitTemplates(eventType: EventType): { recommended: Template[]; others: Template[] } {
  const recommended = TEMPLATES.filter((t) => t.recommendedFor.includes(eventType));
  const others = TEMPLATES.filter((t) => !t.recommendedFor.includes(eventType));
  return { recommended, others };
}

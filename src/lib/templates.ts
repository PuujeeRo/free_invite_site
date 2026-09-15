export type OrnamentMotif = "floral" | "rings" | "stars" | "confetti" | "leaf" | "tassel";

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
}

// 6 templates for v1 -- fewer, nicer, per the product doc. Palette is warm and
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
  },
];

export function getTemplate(id: string): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

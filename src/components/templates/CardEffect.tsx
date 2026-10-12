import type { CSSProperties } from "react";
import type { CardEffect } from "@/lib/theme";

// Animated overlay for the invitation card. Pure CSS: every particle is a span
// whose motion is one of a few keyframes in globals.css, so an effect costs no
// JavaScript at runtime and keeps running in the in-app browsers most guests
// open invitations in.
//
// Particle positions come from a fixed formula, not Math.random(): the card is
// rendered on the server and again in the browser, and random values would
// differ between the two and make React discard the server's markup.
function particles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    left: (i * 37 + 11) % 100, // % across the card; 37 is coprime to 100, so they spread evenly
    delay: (i * 1.7) % 9, // seconds into its loop each particle starts
    duration: 8 + ((i * 3) % 7), // seconds per pass
    size: 4 + ((i * 5) % 5), // px
  }));
}

// A negative delay starts each particle part-way through its loop, so the card
// opens with the effect already in full flow instead of an empty first second.
const motion = (p: { left: number; delay: number; duration: number }): CSSProperties => ({
  left: `${p.left}%`,
  animationDuration: `${p.duration}s`,
  animationDelay: `-${p.delay}s`,
});

const CONFETTI_COLORS = ["#d9a441", "#c96a6a", "#6a9bc9", "#7fae7a", "#b58ac9"];

const SPARKLE_SPOTS = [
  [12, 14], [84, 9], [28, 38], [70, 30], [9, 62], [91, 55], [46, 12], [58, 72], [20, 86], [80, 84],
] as const;

export function CardEffectLayer({
  effect,
  accentClass,
  accentStyle,
}: {
  effect: CardEffect;
  // Sparkles and hearts take the card's accent colour; snow and confetti have
  // colours of their own.
  accentClass: string;
  accentStyle?: CSSProperties;
}) {
  if (effect === "none") return null;

  if (effect === "sheen") {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* slow sheen, like light moving across paper stock */}
        <div className="animate-sheen absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      </div>
    );
  }

  // `card-effect-motion` is switched off entirely under prefers-reduced-motion
  // (globals.css): frozen particles would be scattered dots, not an effect.
  const layer = "card-effect-motion pointer-events-none absolute inset-0 overflow-hidden";

  if (effect === "snow") {
    return (
      <div aria-hidden="true" className={layer}>
        {particles(16).map((p, i) => (
          // The falling wrapper is the full height of the card, so translating
          // it by a percentage moves the flake by a fraction of the CARD -- a
          // transform-only animation that needs no knowledge of the card's
          // pixel height.
          <span key={i} className="animate-fall absolute inset-y-0 w-0" style={motion(p)}>
            <span
              className="animate-sway absolute top-0 block rounded-full bg-white shadow-[0_0_3px_rgba(70,100,140,0.55)]"
              style={{ width: p.size, height: p.size, animationDelay: `-${p.delay / 2}s` }}
            />
          </span>
        ))}
      </div>
    );
  }

  if (effect === "confetti") {
    return (
      <div aria-hidden="true" className={layer}>
        {particles(18).map((p, i) => (
          <span key={i} className="animate-fall absolute inset-y-0 w-0" style={motion(p)}>
            <span
              className="animate-tumble absolute top-0 block rounded-[1px]"
              style={{
                width: p.size + 1,
                height: (p.size + 1) * 1.6,
                backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDelay: `-${p.delay / 3}s`,
              }}
            />
          </span>
        ))}
      </div>
    );
  }

  if (effect === "hearts") {
    return (
      <div aria-hidden="true" className={`${layer} ${accentClass}`} style={accentStyle}>
        {particles(10).map((p, i) => (
          <span key={i} className="animate-rise absolute inset-y-0 w-0" style={motion(p)}>
            <svg viewBox="0 0 20 18" className="absolute top-0 block" style={{ width: p.size * 2.2, height: p.size * 2 }}>
              <path
                fill="currentColor"
                d="M10 17 C 1 10.5, 2 2, 6.6 2.4 C 8.4 2.6, 10 4.2, 10 5.6 C 10 4.2, 11.6 2.6, 13.4 2.4 C 18 2, 19 10.5, 10 17 Z"
              />
            </svg>
          </span>
        ))}
      </div>
    );
  }

  // sparkle
  return (
    <div aria-hidden="true" className={`${layer} ${accentClass}`} style={accentStyle}>
      {SPARKLE_SPOTS.map(([left, top], i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className="animate-twinkle absolute"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: 8 + (i % 3) * 4,
            height: 8 + (i % 3) * 4,
            animationDelay: `-${(i * 0.37) % 2.4}s`,
          }}
        >
          <path fill="currentColor" d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" />
        </svg>
      ))}
    </div>
  );
}

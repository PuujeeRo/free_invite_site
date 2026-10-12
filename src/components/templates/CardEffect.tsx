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
    size: 4 + ((i * 5) % 5), // base unit in px; each effect scales it to its own shape
    rest: (i * 53 + 7) % 96, // % down the card where it sits when motion is reduced
  }));
}

// A negative delay starts each particle part-way through its loop, so the card
// opens with the effect already in full flow instead of an empty first second.
const motion = (p: { left: number; delay: number; duration: number; rest: number }) =>
  ({
    left: `${p.left}%`,
    animationDuration: `${p.duration}s`,
    animationDelay: `-${p.delay}s`,
    // Read by the reduced-motion rule in globals.css.
    "--rest": `${p.rest}%`,
  }) as CSSProperties;

const CONFETTI_COLORS = ["#d9a441", "#c96a6a", "#6a9bc9", "#7fae7a", "#b58ac9"];

const PETAL_COLORS = ["#f4b8c5", "#f7cfd6", "#eea0b4", "#fbe3e7"];

// Where each firework goes off (% across, % down), its colour and its size.
const FIREWORKS = [
  [22, 18, "#f2c14e", 86],
  [76, 12, "#e86a8f", 70],
  [50, 34, "#6ab7e8", 96],
  [14, 52, "#9ad27c", 62],
  [86, 46, "#f2c14e", 78],
  [36, 68, "#c79cf0", 66],
] as const;

// Soft lights for "glow": % across, % down, size as a fraction of the card's
// width, seconds per pulse.
const GLOW_SPOTS = [
  [18, 16, 62, 6],
  [82, 34, 54, 8],
  [30, 72, 70, 7],
  [78, 86, 48, 9],
] as const;

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
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 overflow-hidden ${accentClass}`}
        style={accentStyle}
      >
        {/* Light moving across paper stock. Two bands in one: white, which
            shows on a dark card, and the card's accent colour, without which
            the sheen was invisible on cream and other pale papers. */}
        <div className="animate-sheen absolute inset-y-0 -left-1/2 w-1/2">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-current to-transparent opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        </div>
      </div>
    );
  }

  // Under prefers-reduced-motion the particles stop travelling and fade in
  // place instead (the `card-effect-motion` rules in globals.css).
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
              style={{ width: p.size * 3.2 + 2, height: p.size * 3.2 + 2, animationDelay: `-${p.delay / 2}s` }}
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
                width: p.size + 10,
                height: (p.size + 10) * 1.6,
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
            <svg viewBox="0 0 20 18" className="absolute top-0 block" style={{ width: p.size * 6, height: p.size * 5.4 }}>
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

  if (effect === "petals") {
    return (
      <div aria-hidden="true" className={layer}>
        {particles(14).map((p, i) => (
          <span key={i} className="animate-fall absolute inset-y-0 w-0" style={motion(p)}>
            {/* Two opposite corners rounded makes a petal out of a square. */}
            <span
              className="animate-sway absolute top-0 block rounded-[80%_0_80%_0] shadow-[0_1px_2px_rgba(120,40,60,0.25)]"
              style={{
                width: p.size + 20,
                height: p.size + 20,
                backgroundColor: PETAL_COLORS[i % PETAL_COLORS.length],
                rotate: `${(i * 47) % 360}deg`,
                animationDelay: `-${p.delay / 2}s`,
              }}
            />
          </span>
        ))}
      </div>
    );
  }

  if (effect === "balloons") {
    return (
      <div aria-hidden="true" className={layer}>
        {particles(9).map((p, i) => (
          <span key={i} className="animate-rise absolute inset-y-0 w-0" style={motion(p)}>
            <svg
              viewBox="0 0 20 34"
              className="absolute top-0 block"
              style={{ width: p.size * 5, height: p.size * 8.5 }}
            >
              <ellipse cx="10" cy="10" rx="8.5" ry="10" fill={CONFETTI_COLORS[i % CONFETTI_COLORS.length]} />
              <ellipse cx="7" cy="6" rx="2" ry="3" fill="#fff" opacity="0.45" />
              <path d="M10 20 L8.6 22.4 H11.4 Z" fill={CONFETTI_COLORS[i % CONFETTI_COLORS.length]} />
              <path d="M10 22.4 C 12 26, 8 29, 10 33" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
            </svg>
          </span>
        ))}
      </div>
    );
  }

  if (effect === "fireworks") {
    return (
      <div aria-hidden="true" className={layer}>
        {FIREWORKS.map(([left, top, color, size], i) => (
          <svg
            key={i}
            viewBox="-10 -10 20 20"
            className="animate-burst absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              animationDelay: `-${(i * 0.9) % 2.8}s`,
            }}
          >
            {Array.from({ length: 12 }, (_, ray) => (
              <g key={ray} transform={`rotate(${ray * 30})`}>
                <line x1="0" y1="-3" x2="0" y2="-8" stroke={color} strokeWidth="0.7" strokeLinecap="round" />
                <circle cx="0" cy="-9.2" r="0.7" fill={color} />
              </g>
            ))}
          </svg>
        ))}
      </div>
    );
  }

  if (effect === "glow") {
    return (
      <div aria-hidden="true" className={`${layer} ${accentClass}`} style={accentStyle}>
        {GLOW_SPOTS.map(([left, top, size, seconds], i) => (
          <span
            key={i}
            className="animate-twinkle absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full bg-current opacity-20 blur-2xl"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size}%`,
              animationDuration: `${seconds}s`,
              animationDelay: `-${i * 1.6}s`,
            }}
          />
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
            width: 20 + (i % 3) * 11,
            height: 20 + (i % 3) * 11,
            animationDelay: `-${(i * 0.37) % 2.4}s`,
          }}
        >
          <path fill="currentColor" d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" />
        </svg>
      ))}
    </div>
  );
}

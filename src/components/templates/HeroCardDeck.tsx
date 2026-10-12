"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * The landing hero's rotating set of invitation cards.
 *
 * Every card is rendered, stacked in one grid cell, and only the active one is
 * visible. Stacking (rather than mounting one at a time) keeps the deck's size
 * equal to its tallest card, so the hero does not shift as cards change, and it
 * means the server-rendered markup already contains the first card.
 *
 * The change is a cross-fade with a small rise. It is opacity-led on purpose:
 * a visitor whose system asks for reduced motion still gets the rotation, as a
 * plain fade (see globals.css), instead of a deck that sits frozen on card one.
 * Rotation pauses while the pointer or keyboard focus is on the deck, so
 * nobody has a button move out from under them.
 */
export function HeroCardDeck({
  cards,
  labels,
  intervalMs = 5000,
}: {
  cards: ReactNode[];
  labels: string[]; // one per card, for the position buttons
  intervalMs?: number;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || cards.length < 2) return;
    const timer = window.setInterval(() => setActive((i) => (i + 1) % cards.length), intervalMs);
    return () => window.clearInterval(timer);
  }, [paused, cards.length, intervalMs]);

  return (
    <div
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative"
    >
      <div className="grid">
        {cards.map((card, i) => {
          const shown = i === active;
          return (
            <div
              key={i}
              // inert removes a hidden card from the tab order and from
              // assistive technology; its links must not be reachable while
              // it is invisible.
              inert={!shown}
              aria-hidden={!shown}
              className={`hero-deck-card [grid-area:1/1] ${shown ? "hero-deck-card-shown" : ""}`}
            >
              {card}
            </div>
          );
        })}
      </div>

      {cards.length > 1 && (
        <div className="absolute inset-x-0 top-4 z-10 flex justify-center gap-1.5">
          {cards.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={labels[i]}
              aria-current={i === active}
              onClick={() => setActive(i)}
              // The visible mark is small; the padding gives it a finger-sized
              // target without making the dots themselves heavy.
              className="group -my-2 px-0.5 py-2 focus-visible:outline-none"
            >
              <span
                className={`block h-1.5 rounded-full shadow-sm transition-all group-focus-visible:ring-2 group-focus-visible:ring-white ${
                  i === active ? "w-5 bg-white" : "w-1.5 bg-white/55 group-hover:bg-white/80"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

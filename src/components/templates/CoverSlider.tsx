"use client";

import { useRef, useState } from "react";

/**
 * Swipeable cover for a card with more than one image. Fills its parent, which
 * decides the shape (the 4:3 cover slot, or the whole card for the "full"
 * layout).
 *
 * Built on native horizontal scrolling with scroll-snap rather than a JS
 * carousel: swiping, momentum and keyboard scrolling then come from the
 * browser, which matters on the low-end phones and in-app browsers most guests
 * open invitations in. JS only adds the arrows and the position dots.
 *
 * Plain <img>, not next/image: slides are either blob: previews or already
 * sized by /api/img, so there is nothing left for the optimizer to do.
 */
export function CoverSlider({ slides, alt }: { slides: string[]; alt: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  // A linked image can be gone or blocked by its host. A slide that fails to
  // load is dropped instead of leaving a broken-image box in the middle.
  const [failed, setFailed] = useState<string[]>([]);

  const visible = slides.filter((src) => !failed.includes(src));
  if (visible.length === 0) return null;
  const current = Math.min(index, visible.length - 1);

  function goTo(next: number) {
    const track = trackRef.current;
    if (!track) return;
    const clamped = (next + visible.length) % visible.length;
    track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="absolute inset-0">
      <div
        ref={trackRef}
        onScroll={(e) => {
          const track = e.currentTarget;
          if (track.clientWidth > 0) setIndex(Math.round(track.scrollLeft / track.clientWidth));
        }}
        className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {visible.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- see component doc
          <img
            key={src}
            src={src}
            alt={i === 0 ? alt : ""}
            loading={i === 0 ? "eager" : "lazy"}
            draggable={false}
            onError={() => setFailed((list) => (list.includes(src) ? list : [...list, src]))}
            className="h-full w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>

      {visible.length > 1 && (
        <>
          {/* Controls sit in the upper part of the slot: in the "full" layout
              the card's text overlays the lower part and would cover them. */}
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center gap-1.5">
            {visible.map((src, i) => (
              <span
                key={src}
                className={`h-1.5 rounded-full shadow-sm transition-all ${
                  i === current ? "w-4 bg-white" : "w-1.5 bg-white/55"
                }`}
              />
            ))}
          </div>
          {(["prev", "next"] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              aria-label={direction === "prev" ? "Previous image" : "Next image"}
              onClick={() => goTo(current + (direction === "prev" ? -1 : 1))}
              className={`absolute top-[32%] z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/55 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none ${
                direction === "prev" ? "left-2" : "right-2"
              }`}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                <path
                  d={direction === "prev" ? "M12.5 4.5 L7 10 L12.5 15.5" : "M7.5 4.5 L13 10 L7.5 15.5"}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

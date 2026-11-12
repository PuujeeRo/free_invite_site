"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getTemplate } from "@/lib/templates";
import { Ornament } from "./Ornament";

// The guest page opens on a sealed envelope in the invitation's own paper.
// Tapping it cracks the seal, opens the flap, lifts the card out and fades
// into the real page underneath.
//
// The page is rendered underneath from the start (server-rendered, so nothing
// waits on this component), with its entrance animations paused by the
// `envelope-closed` class until the envelope is out of the way -- otherwise
// the card's own fade-in would play, unseen, behind the envelope.
//
// Timings below must match the transition delays in globals.css (.envelope-*).
const REVEAL_AT_MS = 3000; // overlay starts fading, page animations resume
// Played in full even with the OS "reduce motion" setting on: see the note on
// the envelope's reduced-motion rules in globals.css.
const DONE_AT_MS = 4000; // overlay removed

type Phase = "closed" | "opening" | "revealing" | "done";

export function EnvelopeReveal({
  templateId,
  eventName,
  frontLine,
  dateLine,
  tapLabel,
  children,
}: {
  templateId: string;
  eventName: string;
  // Written on the front: the guest's name for a personal link, otherwise a
  // generic "you're invited".
  frontLine: string;
  dateLine: string;
  tapLabel: string;
  children: React.ReactNode;
}) {
  const template = getTemplate(templateId);
  const [phase, setPhase] = useState<Phase>("closed");
  const timers = useRef<number[]>([]);

  const open = useCallback(() => {
    if (phase !== "closed") return;
    setPhase("opening");
    timers.current.push(
      window.setTimeout(() => setPhase("revealing"), REVEAL_AT_MS),
      window.setTimeout(() => setPhase("done"), DONE_AT_MS)
    );
  }, [phase]);

  // While the envelope covers the screen the page behind it must not scroll.
  useEffect(() => {
    if (phase === "done") return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [phase]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  const headingClass = template.uppercaseName
    ? "text-sm font-semibold uppercase tracking-[0.16em]"
    : template.display === "serif"
      ? "font-display text-lg font-medium leading-tight"
      : "text-base font-semibold leading-tight";
  const monogram = Array.from(eventName.trim())[0]?.toUpperCase() ?? "✦";
  const paper = `bg-gradient-to-br ${template.gradient}`;

  return (
    <>
      <div className={phase === "closed" || phase === "opening" ? "envelope-closed contents" : "contents"}>
        {children}
      </div>

      {phase !== "done" && (
        <div
          className={`envelope-overlay fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-hidden bg-background px-4 ${
            phase !== "closed" ? "envelope-opening" : ""
          } ${phase === "revealing" ? "envelope-revealing" : ""}`}
        >
          {/* Soft glow in the template's accent behind the envelope. */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,currentColor,transparent_55%)] opacity-[0.14] dark:opacity-[0.2] ${template.accent}`}
          />
          <Sparkles className={template.accent} />

          <button
            type="button"
            onClick={open}
            aria-label={`${frontLine}. ${tapLabel}`}
            className="envelope-stage relative w-[min(84vw,22rem)] cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-current/40 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            <div className="envelope-float">
              <div className="envelope relative aspect-[7/5] w-full">
                {/* Inside of the envelope: same paper, in shadow. */}
                <div className={`absolute inset-0 rounded-md ${paper}`}>
                  <div className="absolute inset-0 rounded-md bg-black/15" />
                </div>

                {/* The card that slides out. */}
                <div
                  className={`envelope-letter absolute inset-x-[6%] top-[5%] bottom-[5%] flex flex-col items-center justify-center gap-1.5 rounded-sm px-3 text-center shadow-[0_2px_10px_rgba(0,0,0,0.12)] ${paper}`}
                >
                  <div className={`pointer-events-none absolute inset-1.5 rounded-[3px] border ${template.frameBorder}`} />
                  <Ornament motif={template.ornament} compact className={template.accent} />
                  <p className={`line-clamp-2 text-balance ${headingClass} ${template.textOnGradient}`}>
                    {eventName}
                  </p>
                  <p className={`text-[10px] opacity-75 ${template.textOnGradient}`}>{dateLine}</p>
                </div>

                {/* Front pocket: side and bottom flaps, folds drawn as hairlines. */}
                <div className={`envelope-front absolute inset-0 rounded-md ${paper}`}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/[0.07] to-transparent" />
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className={`absolute inset-0 h-full w-full ${template.textOnGradient}`}
                  >
                    <path
                      d="M0 100 L50 54 L100 100"
                      fill="none"
                      stroke="currentColor"
                      strokeOpacity="0.14"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  <p
                    className={`absolute inset-x-0 bottom-[11%] truncate px-6 text-center font-display text-base italic sm:text-lg ${template.textOnGradient}`}
                  >
                    {frontLine}
                  </p>
                </div>

                {/* Top flap, hinged on the top edge, with the wax seal on its tip. */}
                <div className="envelope-flap absolute inset-x-0 top-0 h-[58%]">
                  <div className={`envelope-flap-paper absolute inset-0 rounded-t-md ${paper}`}>
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-black/[0.06]" />
                  </div>
                  <span
                    className={`envelope-seal absolute top-full left-1/2 grid size-12 place-items-center rounded-full bg-current shadow-[0_3px_8px_rgba(0,0,0,0.3),inset_0_-3px_6px_rgba(0,0,0,0.25),inset_0_2px_4px_rgba(255,255,255,0.3)] sm:size-14 ${template.accent}`}
                  >
                    <span className="grid size-[78%] place-items-center rounded-full border border-white/35">
                      <span className="font-display text-lg leading-none font-semibold text-white/90 sm:text-xl">
                        {monogram}
                      </span>
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </button>

          <p className="envelope-hint text-sm font-medium text-zinc-500 dark:text-zinc-400">{tapLabel}</p>
        </div>
      )}

      {/* Without JavaScript the envelope could never be opened, so it is not shown. */}
      <noscript>
        <style>{`.envelope-overlay{display:none!important}.envelope-closed .animate-fade-in-up{animation-play-state:running!important}`}</style>
      </noscript>
    </>
  );
}

// A few still points of light around the envelope, twinkling out of step.
const SPARKS = [
  { left: "14%", top: "22%", delay: "0s", size: 6 },
  { left: "82%", top: "18%", delay: "0.8s", size: 8 },
  { left: "88%", top: "64%", delay: "1.6s", size: 5 },
  { left: "10%", top: "70%", delay: "1.1s", size: 7 },
  { left: "50%", top: "12%", delay: "2s", size: 5 },
  { left: "30%", top: "84%", delay: "0.4s", size: 5 },
];

function Sparkles({ className }: { className: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`}>
      {SPARKS.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 10 10"
          className="animate-twinkle absolute"
          style={{ left: s.left, top: s.top, width: s.size * 2, height: s.size * 2, animationDelay: s.delay }}
        >
          <path d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z" fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}

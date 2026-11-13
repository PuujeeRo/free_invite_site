"use client";

import { useEffect, useState } from "react";

export interface CountdownLabels {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  started: string;
}

function getRemaining(target: number) {
  const diff = Math.max(0, target - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    done: diff <= 0,
  };
}

export function CountdownTimer({
  eventDate,
  eventTime,
  labels,
  textClassName = "",
  chipClassName = "",
}: {
  eventDate: string;
  eventTime: string | null;
  labels: CountdownLabels;
  textClassName?: string;
  chipClassName?: string;
}) {
  const target = new Date(`${eventDate}T${eventTime ?? "00:00"}`).getTime();
  const [remaining, setRemaining] = useState(() => getRemaining(target));

  useEffect(() => {
    const id = setInterval(() => setRemaining(getRemaining(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  // No date yet (the create form and its preview before one is picked), or
  // one that does not parse: there is nothing to count down to.
  if (Number.isNaN(target)) return null;

  if (remaining.done) {
    return <p className={`text-sm font-medium ${textClassName}`}>{labels.started}</p>;
  }

  const units: { value: number; label: string }[] = [
    { value: remaining.days, label: labels.days },
    { value: remaining.hours, label: labels.hours },
    { value: remaining.minutes, label: labels.minutes },
    { value: remaining.seconds, label: labels.seconds },
  ];

  return (
    // Fixed 4-column grid rather than flex: keeps every chip equal width and
    // never overflows, down to a 280px-wide Galaxy Fold screen.
    <div className={`grid w-full grid-cols-4 gap-1 sm:gap-2 ${textClassName}`}>
      {units.map((unit) => (
        <div
          key={unit.label}
          className={`min-w-0 rounded-lg px-1 py-1.5 backdrop-blur-sm sm:rounded-xl sm:px-2 ${chipClassName}`}
        >
          {/* The remaining time is computed from the current clock, so the value
              rendered during SSR is legitimately a second or two behind the one
              the client computes at hydration. suppressHydrationWarning is the
              intended escape hatch for exactly this; the interval corrects the
              displayed value within a second either way. */}
          <div className="text-base font-semibold tabular-nums sm:text-lg" suppressHydrationWarning>
            {unit.value}
          </div>
          <div className="truncate text-[9px] tracking-wide opacity-70 sm:text-[10px]">{unit.label}</div>
        </div>
      ))}
    </div>
  );
}

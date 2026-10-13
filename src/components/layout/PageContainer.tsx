import type { ReactNode } from "react";

// Tailwind scans source files for literal class-name strings, so the max-width
// must be a lookup table rather than an interpolated `max-w-${size}` -- a
// template literal never produces a complete class name for the scanner to find,
// and the corresponding CSS silently never gets generated.
export const MAX_WIDTH = {
  sm: "max-w-sm", // ~384px -- single-column confirmation screens
  md: "max-w-md", // ~448px -- login, narrow single-column forms
  lg: "max-w-2xl", // ~672px -- standard form screens (new event, edit, event overview)
  xl: "max-w-3xl", // ~768px -- content-dense screens (guest responses table)
  "2xl": "max-w-4xl", // ~896px -- list views (dashboard event list)
  "3xl": "max-w-7xl", // ~1280px -- wide showcase sections (landing hero, demo)
} as const;

export type PageMaxWidth = keyof typeof MAX_WIDTH;

// The one standard wrapper for every dashboard/auth/utility "screen" page --
// centers content, caps its width per screen (see MAX_WIDTH above), and applies
// the same responsive padding scale used elsewhere in the app instead of each
// page hand-rolling a slightly different max-w/px/py combination.
export function PageContainer({
  maxWidth = "lg",
  className = "",
  children,
}: {
  maxWidth?: PageMaxWidth;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10 ${MAX_WIDTH[maxWidth]} ${className}`}
    >
      {children}
    </div>
  );
}

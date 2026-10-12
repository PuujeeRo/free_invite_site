import type { ReactNode } from "react";
import type { Template } from "@/lib/templates";
import { Ornament } from "./Ornament";

/**
 * A template drawn small: its paper, frame, ornament and heading treatment,
 * carrying a name. Used by the template picker (as the face of each option)
 * and by the landing page shelf, so the two can never drift apart -- what the
 * landing page shows is exactly what the picker offers.
 *
 * Purely visual and server-renderable; the caller supplies any ring, tilt or
 * click behaviour around it through `className` and `children`.
 */
export function TemplateMiniCard({
  template,
  name,
  className = "",
  children,
}: {
  template: Template;
  name: string;
  className?: string;
  children?: ReactNode; // overlays, e.g. the picker's "selected" check
}) {
  // Mirrors the heading rules in InvitationCard, scaled down.
  const headingClass = template.uppercaseName
    ? "text-[9px] font-semibold tracking-[0.14em] uppercase"
    : template.display === "serif"
      ? "font-display text-xs font-medium"
      : "text-[11px] font-semibold";

  return (
    <span
      className={`relative flex aspect-3/4 w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-br px-2.5 text-center ${template.gradient} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-1.5 rounded-lg border ${template.frameBorder}`}
      />
      <span className={template.accent}>
        <Ornament motif={template.ornament} compact />
      </span>
      <span className={`line-clamp-3 w-full leading-tight wrap-break-word ${headingClass} ${template.textOnGradient}`}>
        {name}
      </span>
      <span aria-hidden="true" className={`h-px w-6 ${template.divider}`} />
      {children}
    </span>
  );
}

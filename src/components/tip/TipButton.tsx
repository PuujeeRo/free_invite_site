"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * The "support us" link that sits with the header controls on every page.
 * The service is free; this is the only place it asks for anything, and it
 * only ever asks -- nothing is held back from someone who does not tip.
 */
export function TipButton() {
  const { dict: t } = useI18n();
  const pathname = usePathname();
  // Nothing to link to from the tip pages themselves.
  if (pathname?.startsWith("/tip")) return null;

  return (
    <Link
      href="/tip"
      title={t.tip.navTitle}
      className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition-colors visited:text-rose-700 hover:border-rose-300 hover:bg-rose-100 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200 dark:visited:text-rose-200 dark:hover:border-rose-700"
    >
      <svg viewBox="0 0 20 18" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
        <path
          fill="currentColor"
          d="M10 17 C 1 10.5, 2 2, 6.6 2.4 C 8.4 2.6, 10 4.2, 10 5.6 C 10 4.2, 11.6 2.6, 13.4 2.4 C 18 2, 19 10.5, 10 17 Z"
        />
      </svg>
      {/* On a phone the header is already full: the heart alone, with the
          label still read out. */}
      <span className="max-sm:sr-only">{t.tip.navLabel}</span>
    </Link>
  );
}

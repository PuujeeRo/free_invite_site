import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";

// Signed-in marker for the public pages (home, demo, invitation), which
// otherwise look identical whether or not you have a session and offer no way
// back to your own invitations. Renders nothing for visitors, so guests opening
// an invitation never see it. Sign-out deliberately stays in the dashboard
// header: this is a way in, not an account menu.
export async function AccountButton() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const t = getDictionary(await getLocale());

  // Signed out: a plain sign-in link, so the way in is visible on every public page.
  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-500 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-50 dark:focus-visible:ring-zinc-100"
      >
        {t.common.signIn}
      </Link>
    );
  }

  // A local/dev sign-in can have no email. A "?" there read as a help
  // button, so a person glyph stands in instead.
  const initial = user.email ? user.email.charAt(0).toUpperCase() : null;
  const label = user.email ? `${t.dashboard.navLabel} (${user.email})` : t.dashboard.navLabel;

  return (
    <Link
      href="/dashboard"
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white transition-colors visited:text-white hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-zinc-50 dark:text-zinc-900 dark:visited:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100"
    >
      {initial ? (
        <span aria-hidden="true">{initial}</span>
      ) : (
        <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
          <circle cx="10" cy="7" r="3.2" fill="currentColor" />
          <path d="M3.5 17 C 3.5 13.2, 6.4 11.4, 10 11.4 C 13.6 11.4, 16.5 13.2, 16.5 17 Z" fill="currentColor" />
        </svg>
      )}
    </Link>
  );
}

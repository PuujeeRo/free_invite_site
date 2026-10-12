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

  if (!user) return null;

  const t = getDictionary(await getLocale());
  const initial = (user.email ?? "?").charAt(0).toUpperCase();
  const label = user.email ? `${t.dashboard.navLabel} (${user.email})` : t.dashboard.navLabel;

  return (
    <Link
      href="/dashboard"
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white transition-colors visited:text-white hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-zinc-50 dark:text-zinc-900 dark:visited:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100"
    >
      <span aria-hidden="true">{initial}</span>
    </Link>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import { TopControls } from "@/components/theme/TopControls";
import { Logo } from "@/components/brand/Logo";
import { HeaderRow } from "@/components/layout/HeaderRow";
import { signOut } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // The name the organizer gave themselves, if any; otherwise their email.
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const accountLabel = profile?.display_name || user.email;

  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 px-4 py-4 sm:px-6 dark:border-zinc-800">
        <HeaderRow maxWidth="2xl">
          {/* Logo goes to the public home page, as on every other screen. It used
              to point at /dashboard, which left signed-in users with no way
              back to the home page at all, so the event list gets its own
              text link instead. */}
          <Link href="/" className="text-zinc-900 dark:text-zinc-50">
            <Logo markClassName="h-5 w-5" textClassName="text-base" />
          </Link>
          <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-zinc-50">
              {t.dashboard.navLabel}
            </Link>
            <TopControls />
            {/* Was a plain line of text: there was nowhere to change
                anything about the account. On a phone, where the name is
                dropped for space, the word "Profile" stands in for it. */}
            <Link href="/dashboard/profile" className="hover:text-zinc-900 dark:hover:text-zinc-50">
              <span className="hidden max-w-48 truncate align-bottom sm:inline-block">
                {accountLabel ?? t.profile.navLabel}
              </span>
              <span className="sm:hidden">{t.profile.navLabel}</span>
            </Link>
            <form action={signOut}>
              <button type="submit" className="hover:text-zinc-900 dark:hover:text-zinc-50">
                {t.common.signOut}
              </button>
            </form>
          </div>
        </HeaderRow>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

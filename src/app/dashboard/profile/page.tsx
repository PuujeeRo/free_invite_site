import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import { PageContainer } from "@/components/layout/PageContainer";
import { getGmailConnection, gmailConfigured } from "@/lib/email/gmail";
import { signOut } from "../actions";
import { disconnectGmailFromProfile } from "./actions";
import { DeleteAccountButton, ProfileForm } from "./ProfileForm";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ gmail?: string }> }) {
  const { gmail: gmailResult } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // select("*") rather than naming display_name: on a database without
  // migration 0016 the column is simply absent instead of the query failing.
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  const t = getDictionary(await getLocale());
  const gmailOffered = gmailConfigured();
  const gmail = gmailOffered ? await getGmailConnection(user.id) : null;

  return (
    <PageContainer maxWidth="lg">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t.profile.title}</h1>

      <section className="mt-6">
        <ProfileForm email={profile?.email ?? user.email ?? null} displayName={profile?.display_name ?? ""} />
      </section>

      {gmailOffered && (
        <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.profile.gmailTitle}</h2>
          <p className="mt-1 max-w-[60ch] text-xs text-pretty text-zinc-500">{t.eventOverview.gmailConnectHint}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {gmail ? (
              <>
                <span className="text-zinc-700 dark:text-zinc-300">
                  {t.eventOverview.gmailConnected.replace("{email}", gmail.email)}
                </span>
                <form action={disconnectGmailFromProfile}>
                  <button type="submit" className="font-medium underline underline-offset-4">
                    {t.eventOverview.gmailDisconnect}
                  </button>
                </form>
              </>
            ) : (
              <a
                href="/api/google/connect?back=/dashboard/profile"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300"
              >
                {t.eventOverview.gmailConnect}
              </a>
            )}
          </div>
          {gmailResult && gmailResult !== "connected" && (
            <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
              {gmailResult === "cancelled"
                ? t.eventOverview.gmailCancelled
                : gmailResult === "denied"
                  ? t.eventOverview.gmailDenied
                  : t.eventOverview.gmailFailed}
            </p>
          )}
        </section>
      )}

      <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300"
          >
            {t.common.signOut}
          </button>
        </form>
      </section>

      <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.profile.deleteTitle}</h2>
        <p className="mt-1 max-w-[60ch] text-xs text-pretty text-zinc-500">{t.profile.deleteBody}</p>
        <div className="mt-3">
          <DeleteAccountButton />
        </div>
      </section>
    </PageContainer>
  );
}

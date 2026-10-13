import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import { PageContainer } from "@/components/layout/PageContainer";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { MAX_LIVE_INVITATIONS } from "@/lib/event-types";
import { CreateFormLoader } from "./CreateFormLoader";

// The new-invitation form, open to everyone. It used to live behind the
// dashboard's sign-in wall, which asked for an email before a visitor had seen
// what they would get. Now signing in is asked for only at the moment of
// creating (see NewEventForm and lib/create-stash.ts).
export default async function CreatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Told up front, not after filling in the whole form. The database enforces
  // the same number (guard_event_insert, migration 0014); this is the warning.
  let atLiveLimit = false;
  if (user) {
    const { count } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("is_paid", false)
      .gt("expires_at", new Date().toISOString());
    atLiveLimit = (count ?? 0) >= MAX_LIVE_INVITATIONS;
  }

  const t = getDictionary(await getLocale());

  // Wider than a normal form screen: the form sits beside a full-size live
  // preview. max-w-6xl is not one of PageContainer's standard widths, so the
  // container is opened to its widest and capped here instead.
  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />
      <PageContainer maxWidth="3xl">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t.newEvent.title}</h1>
          <p className="mt-2 max-w-[70ch] text-sm text-pretty text-zinc-600 dark:text-zinc-400">
            {t.newEvent.infoLine.replace("{live}", String(MAX_LIVE_INVITATIONS))}
          </p>
          <div className="mt-8">
            <CreateFormLoader signedIn={Boolean(user)} atLiveLimit={atLiveLimit} />
          </div>
        </div>
      </PageContainer>
    </div>
  );
}

export const dynamic = "force-dynamic";

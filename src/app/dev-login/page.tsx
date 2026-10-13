import { notFound } from "next/navigation";
import { isLocalDevMode } from "@/lib/supabase/local-dev";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/supabase/types";
import { devSignIn, devSignInOrCreate } from "./actions";
import { safeNextPath } from "@/lib/safe-next";
import { DevLoginForm } from "./DevLoginForm";

// LOCAL_DEV_MODE only: stands in for the real magic-link login page, which
// needs GoTrue (not available -- see lib/supabase/local-dev.ts). 404s outright
// in any other mode, including if this were ever accidentally deployed.
export default async function DevLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!isLocalDevMode()) notFound();
  const next = safeNextPath((await searchParams).next);

  const supabase = createAdminClient();
  const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  const profiles = (data ?? []) as Profile[];

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Local dev sign-in -- no email is sent, this never runs against a real
        Supabase project.
      </div>

      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Sign in (local dev)</h1>

      {profiles.length > 0 && (
        <div className="mt-6 flex flex-col gap-2">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Existing test organizers</p>
          {profiles.map((profile) => (
            <form key={profile.id} action={devSignIn.bind(null, profile.id, next)}>
              <button
                type="submit"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-left text-sm hover:border-zinc-500 dark:border-zinc-700"
              >
                {profile.email ?? profile.id}
              </button>
            </form>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {profiles.length > 0 ? "Or create a new one" : "Create a test organizer"}
      </p>
      <DevLoginForm action={devSignInOrCreate} next={next} />
    </div>
  );
}

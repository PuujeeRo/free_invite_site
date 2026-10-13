"use client";

import { useActionState } from "react";
import type { DevLoginState } from "./actions";

const initialState: DevLoginState = {};

export function DevLoginForm({
  action,
  next,
}: {
  next: string;
  action: (prevState: DevLoginState, formData: FormData) => Promise<DevLoginState>;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <input
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {isPending ? "Signing in…" : "Sign in / create"}
      </button>
      {state.error && <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}

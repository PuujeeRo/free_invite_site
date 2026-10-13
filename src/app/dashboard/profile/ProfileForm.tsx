"use client";

import { useActionState, useTransition, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { deleteAccount, updateProfile, type ProfileState } from "./actions";

const initialState: ProfileState = {};

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export function ProfileForm({ email, displayName }: { email: string | null; displayName: string }) {
  const { dict: t } = useI18n();
  const [state, formAction, isPending] = useActionState(updateProfile, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t.profile.nameLabel}</span>
        <input name="display_name" defaultValue={displayName} maxLength={60} className={inputClass} />
        <span className="text-xs text-zinc-500">{t.profile.nameHint}</span>
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t.profile.emailLabel}</span>
        {/* Shown, not editable: the address is the sign-in itself. */}
        <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {email ?? "—"}
        </p>
        <span className="text-xs text-zinc-500">{t.profile.emailHint}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? t.profile.saving : t.profile.save}
        </button>
        {state.saved && !isPending && (
          <span role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {t.profile.saved}
          </span>
        )}
        {state.error && !isPending && (
          <span role="alert" className="text-sm text-red-600 dark:text-red-400">
            {t.profile.errorGeneric}
          </span>
        )}
      </div>
    </form>
  );
}

/** Deleting the account, behind a native confirm: rare, and it cannot be undone. */
export function DeleteAccountButton() {
  const { dict: t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(t.profile.deleteConfirm)) return;
          setFailed(false);
          startTransition(async () => {
            // On success the action redirects and never returns here.
            const result = await deleteAccount();
            if (result?.error) setFailed(true);
          });
        }}
        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:border-red-500 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:border-red-700"
      >
        {isPending ? t.profile.deleting : t.profile.deleteButton}
      </button>
      {failed && (
        <span role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t.profile.errorGeneric}
        </span>
      )}
    </div>
  );
}

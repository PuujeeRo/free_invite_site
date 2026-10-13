"use client";

import { useActionState, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { TIP_DEFAULT_MNT, TIP_MAX_MNT, TIP_MIN_MNT, TIP_PRESETS_MNT } from "@/lib/tip-amounts";
import { startTip, type TipState } from "./actions";

const initialState: TipState = {};

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export function TipForm() {
  const { dict: t } = useI18n();
  const [state, formAction, isPending] = useActionState(startTip, initialState);
  const [amount, setAmount] = useState<number>(TIP_DEFAULT_MNT);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState("");

  const error =
    state.error === "amount"
      ? t.tip.errorAmount
          .replace("{min}", TIP_MIN_MNT.toLocaleString("en-US"))
          .replace("{max}", TIP_MAX_MNT.toLocaleString("en-US"))
      : state.error === "unavailable"
        ? t.tip.unavailable
        : state.error
          ? t.tip.errorGeneric
          : null;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <fieldset>
        <legend className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t.tip.amountLabel}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TIP_PRESETS_MNT.map((preset) => (
            <label
              key={preset}
              className="flex cursor-pointer items-center justify-center rounded-xl border border-zinc-300 px-3 py-3 text-sm font-medium text-zinc-800 tabular-nums has-checked:border-zinc-900 has-checked:ring-1 has-checked:ring-zinc-900 has-focus-visible:ring-2 has-focus-visible:ring-zinc-500 dark:border-zinc-700 dark:text-zinc-200 dark:has-checked:border-zinc-50 dark:has-checked:ring-zinc-50"
            >
              <input
                type="radio"
                name="amount"
                value={preset}
                // A typed amount takes over, so no preset stays lit beside it.
                checked={!custom && preset === amount}
                onChange={() => {
                  setAmount(preset);
                  setCustom("");
                }}
                className="sr-only"
              />
              {preset.toLocaleString("en-US")}₮
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t.tip.customAmount}</span>
        <input
          name="amount_custom"
          inputMode="numeric"
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
          placeholder={`${TIP_MIN_MNT.toLocaleString("en-US")}₮ +`}
          className={`${inputClass} tabular-nums`}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t.tip.nameLabel}</span>
        <input
          name="display_name"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t.tip.messageLabel}</span>
        <textarea name="message" maxLength={200} rows={2} className={inputClass} />
      </label>

      {/* Only offered once there is a name to show. */}
      {name.trim() && (
        <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" name="is_public" defaultChecked className="mt-0.5" />
          <span className="text-pretty">{t.tip.publicLabel}</span>
        </label>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? t.tip.submitting : t.tip.submit}
      </button>
    </form>
  );
}

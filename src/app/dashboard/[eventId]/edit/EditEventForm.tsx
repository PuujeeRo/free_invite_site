"use client";

import Link from "next/link";
import { useActionState } from "react";
import { EVENT_TYPES } from "@/lib/event-types";
import { TEMPLATES } from "@/lib/templates";
import { useI18n } from "@/i18n/I18nProvider";
import { CoverImageField } from "@/components/media/CoverImageField";
import { withCoverLimits } from "@/lib/cover-media";
import type { EventRow } from "@/lib/supabase/types";
import type { EventTheme, EventCustomText } from "@/lib/theme";
import { updateEvent, type EditEventState } from "./actions";

const initialState: EditEventState = {};

function editErrorMessage(t: ReturnType<typeof useI18n>["dict"], error: EditEventState["error"]) {
  if (!error) return null;
  if (error === "not_found") return t.edit.errorNotFound;
  const key = {
    enter_name: "errorEnterName",
    choose_date: "errorChooseDate",
    choose_template: "errorChooseTemplate",
    photo_type: "photoErrorType",
    photo_size: "photoErrorSize",
    generic: "errorGeneric",
  } as const satisfies Record<Exclude<EditEventState["error"], "not_found" | undefined>, keyof typeof t.newEvent>;
  return withCoverLimits(t.newEvent[key[error]]);
}

export function EditEventForm({
  event,
  theme,
  customText,
}: {
  event: EventRow;
  theme: EventTheme;
  customText: EventCustomText;
}) {
  const { dict: t } = useI18n();
  const [state, formAction, isPending] = useActionState(updateEvent, initialState);
  const eventTypeLabel = EVENT_TYPES.find((type) => type.id === event.event_type)?.labelMn;

  return (
    <form action={formAction} className="flex flex-col gap-10">
      <input type="hidden" name="event_id" value={event.id} />

      <section>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.edit.basicsTitle}</h2>
        <p className="mt-1 text-xs text-zinc-500">{eventTypeLabel}</p>
        <div className="mt-3 flex flex-col gap-3">
          <Field label={t.newEvent.nameLabel}>
            <input name="name" defaultValue={event.name} required maxLength={80} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.newEvent.dateLabel}>
              <input type="date" name="event_date" defaultValue={event.event_date} required className={inputClass} />
            </Field>
            <Field label={t.newEvent.timeLabel}>
              <input type="time" name="event_time" defaultValue={event.event_time ?? ""} className={inputClass} />
            </Field>
          </div>
          <Field label={t.newEvent.locationLabel}>
            <input name="location" defaultValue={event.location ?? ""} maxLength={140} className={inputClass} />
          </Field>
          <Field label={t.newEvent.descriptionLabel}>
            <textarea
              name="description"
              defaultValue={event.description ?? ""}
              maxLength={400}
              rows={3}
              className={inputClass}
            />
          </Field>
          <CoverImageField currentUrl={event.photo_url} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TEMPLATES.map((template) => (
            <label
              key={template.id}
              className="cursor-pointer overflow-hidden rounded-xl border border-zinc-300 has-checked:border-zinc-900 has-checked:ring-1 has-checked:ring-zinc-900 dark:border-zinc-700 dark:has-checked:border-zinc-50 dark:has-checked:ring-zinc-50"
            >
              <input
                type="radio"
                name="template_id"
                value={template.id}
                defaultChecked={template.id === event.template_id}
                className="sr-only"
              />
              <div className={`h-16 w-full bg-gradient-to-br ${template.gradient}`} />
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{template.name}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.edit.paidTitle}</h2>

        {!event.is_paid ? (
          <p className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {t.edit.paidUpsell}{" "}
            <Link href={`/dashboard/${event.id}/upgrade`} className="font-medium underline underline-offset-4">
              {t.eventOverview.upgrade}
            </Link>
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <Field label={t.edit.accentColorLabel}>
              <input
                type="color"
                name="accent_color"
                defaultValue={theme.accentColor ?? "#18181b"}
                className="h-10 w-16 rounded border border-zinc-300 dark:border-zinc-700"
              />
            </Field>
            <Field label={t.edit.greetingOverrideLabel}>
              <textarea
                name="greeting_override"
                defaultValue={customText.greetingOverride ?? ""}
                placeholder={t.edit.greetingOverridePlaceholder}
                rows={2}
                className={inputClass}
              />
            </Field>
            <Field label={t.edit.videoUrlLabel}>
              <input name="video_url" defaultValue={event.video_url ?? ""} className={inputClass} />
            </Field>
            <Field label={t.edit.mapLinkLabel}>
              <input name="map_link" defaultValue={event.map_link ?? ""} className={inputClass} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" name="countdown_enabled" defaultChecked={event.countdown_enabled} />
              {t.edit.countdownLabel}
            </label>
          </div>
        )}
      </section>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {editErrorMessage(t, state.error)}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? t.edit.saving : t.edit.save}
      </button>
    </form>
  );
}

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

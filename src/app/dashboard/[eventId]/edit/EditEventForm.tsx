"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { EVENT_TYPES, PAYMENTS_ENABLED, featuresUnlocked } from "@/lib/event-types";
import { TemplatePicker } from "@/components/templates/TemplatePicker";
import { useI18n } from "@/i18n/I18nProvider";
import { CoverImageField } from "@/components/media/CoverImageField";
import { withCoverLimits } from "@/lib/cover-media";
import { isGreeting } from "@/lib/greeting";
import { MAX_GALLERY_IMAGES, readGallery } from "@/lib/gallery";
import { CoverLayoutField } from "@/components/media/CoverLayoutField";
import { EffectField } from "@/components/templates/EffectField";
import { parseCardEffect } from "@/lib/theme";
import { parseCoverLayout, type EventRow } from "@/lib/supabase/types";
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
    bad_map_link: "errorMapLink",
    bad_gallery: "errorGallery",
    bad_video_link: "errorVideoLink",
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
  const [templateId, setTemplateId] = useState(event.template_id);
  const greeting = isGreeting(event);
  const unlocked = featuresUnlocked(event.is_paid);
  const [effect, setEffect] = useState(() => parseCardEffect(theme.effect));
  const [coverLayout, setCoverLayout] = useState(() => parseCoverLayout(event.cover_layout));

  return (
    <form action={formAction} className="flex flex-col gap-10">
      <input type="hidden" name="event_id" value={event.id} />

      <section>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.edit.basicsTitle}</h2>
        <p className="mt-1 text-xs text-zinc-500">{eventTypeLabel}</p>
        <div className="mt-3 flex flex-col gap-3">
          {/* Same field set as the new-invitation form: a greeting has a
              recipient, a sender and a message, and no time or place. The kind
              itself is fixed once created and cannot be switched here. */}
          <Field label={greeting ? t.newEvent.recipientLabel : t.newEvent.nameLabel}>
            <input name="name" defaultValue={event.name} required maxLength={80} className={inputClass} />
          </Field>
          {greeting && (
            <Field label={t.newEvent.senderLabel}>
              <input name="sender_name" defaultValue={event.sender_name ?? ""} maxLength={80} className={inputClass} />
            </Field>
          )}
          <div className={greeting ? "grid" : "grid grid-cols-2 gap-3"}>
            <Field label={t.newEvent.dateLabel}>
              <input type="date" name="event_date" defaultValue={event.event_date} required className={inputClass} />
            </Field>
            {!greeting && (
              <Field label={t.newEvent.timeLabel}>
                <input type="time" name="event_time" defaultValue={event.event_time ?? ""} className={inputClass} />
              </Field>
            )}
          </div>
          {!greeting && (
            <Field label={t.newEvent.locationLabel}>
              <input name="location" defaultValue={event.location ?? ""} maxLength={140} className={inputClass} />
            </Field>
          )}
          {/* Sits with the location it belongs to rather than in the extras
              block further down. */}
          {!greeting && unlocked && (
            <Field label={t.edit.mapLinkLabel}>
              <input
                name="map_link"
                defaultValue={event.map_link ?? ""}
                maxLength={500}
                placeholder="https://maps.app.goo.gl/..."
                className={inputClass}
              />
              <span className="text-xs text-zinc-500">{t.newEvent.mapLinkHint}</span>
            </Field>
          )}
          <Field label={greeting ? t.newEvent.messageLabel : t.newEvent.descriptionLabel}>
            <textarea
              name="description"
              defaultValue={event.description ?? ""}
              maxLength={400}
              rows={greeting ? 5 : 3}
              className={inputClass}
            />
          </Field>
          <CoverImageField currentUrl={event.photo_url} />
          <Field label={t.newEvent.galleryLabel}>
            <textarea
              name="gallery_urls"
              defaultValue={readGallery(event.gallery_urls).join("\n")}
              rows={3}
              placeholder={"https://...\nhttps://..."}
              className={inputClass}
            />
            <span className="text-xs text-zinc-500">
              {t.newEvent.galleryHint.replace("{max}", String(MAX_GALLERY_IMAGES))}
            </span>
          </Field>
          <CoverLayoutField value={coverLayout} onChange={setCoverLayout} />
        </div>

        <div className="mt-6">
          <TemplatePicker
            eventType={event.event_type}
            value={templateId}
            onChange={setTemplateId}
            previewName={event.name}
          />
        </div>
      </section>

      {/* Extras. Open to this event -> the fields. Not open but purchasable ->
          the upsell. Not open and nothing to buy cannot happen (see
          featuresUnlocked), so the section always has something to show. */}
      {(unlocked || PAYMENTS_ENABLED) && (
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.edit.paidTitle}</h2>

        {!unlocked ? (
          <p className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {t.edit.paidUpsell}{" "}
            <Link href={`/dashboard/${event.id}/upgrade`} className="font-medium underline underline-offset-4">
              {t.eventOverview.upgrade}
            </Link>
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t.newEvent.stepEffect}</span>
              <EffectField value={effect} onChange={setEffect} />
            </div>
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
              <input type="url" name="video_url" defaultValue={event.video_url ?? ""} maxLength={500} placeholder="https://" className={inputClass} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" name="countdown_enabled" defaultChecked={event.countdown_enabled} />
              {t.edit.countdownLabel}
            </label>
          </div>
        )}
      </section>
      )}

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

"use client";

import { useState } from "react";
import { splitTemplates, type Template } from "@/lib/templates";
import { useI18n } from "@/i18n/I18nProvider";
import type { EventType } from "@/lib/supabase/types";
import { TemplateMiniCard } from "./TemplateMiniCard";

/**
 * Template chooser shared by the new-invitation and edit forms.
 *
 * Templates suggested for the event type come first; the rest sit behind a
 * toggle so eighteen thumbnails are not the first thing the organizer has to
 * read. Every thumbnail is a small rendering of the real card (paper, frame,
 * ornament, heading style) carrying the organizer's own event name, because a
 * strip of colour says nothing about how a serif or an all-caps heading will
 * treat their title.
 *
 * The chosen id travels in a hidden input, so the surrounding <form> submits
 * `template_id` exactly as the old radio group did.
 */
export function TemplatePicker({
  eventType,
  value,
  onChange,
  previewName,
}: {
  eventType: EventType;
  value: string;
  onChange: (templateId: string) => void;
  previewName: string;
}) {
  const { dict: t } = useI18n();
  const { recommended, others } = splitTemplates(eventType);
  const [expanded, setExpanded] = useState(false);

  // A selection must never be hidden: if the chosen template is in the "rest"
  // group (picked earlier, then the event type changed), that group stays open
  // no matter what the toggle says.
  const selectionInOthers = others.some((template) => template.id === value);
  const showOthers = expanded || selectionInOthers;

  return (
    <div role="radiogroup" aria-label={t.newEvent.stepTemplate}>
      <input type="hidden" name="template_id" value={value} />

      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {t.newEvent.templatesRecommended}
      </p>
      <Grid templates={recommended} value={value} onChange={onChange} previewName={previewName} />

      {others.length > 0 && (
        <>
          {/* Hidden while the selection lives in the group below: collapsing
              it then would be a no-op, and a button that does nothing reads as
              broken. */}
          {!selectionInOthers && (
            <button
              type="button"
              aria-expanded={showOthers}
              onClick={() => setExpanded((open) => !open)}
              className="mt-4 rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
            >
              {showOthers
                ? t.newEvent.templatesHideAll
                : t.newEvent.templatesShowAll.replace("{count}", String(others.length))}
            </button>
          )}
          {showOthers && (
            <Grid templates={others} value={value} onChange={onChange} previewName={previewName} />
          )}
        </>
      )}
    </div>
  );
}

function Grid({
  templates,
  value,
  onChange,
  previewName,
}: {
  templates: Template[];
  value: string;
  onChange: (templateId: string) => void;
  previewName: string;
}) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
      {templates.map((template) => (
        <Thumb
          key={template.id}
          template={template}
          selected={template.id === value}
          onSelect={() => onChange(template.id)}
          previewName={previewName}
        />
      ))}
    </div>
  );
}

function Thumb({
  template,
  selected,
  onSelect,
  previewName,
}: {
  template: Template;
  selected: boolean;
  onSelect: () => void;
  previewName: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      title={template.description}
      onClick={onSelect}
      className="group flex flex-col gap-1.5 text-left focus-visible:outline-none"
    >
      <TemplateMiniCard
        template={template}
        name={previewName}
        className={`ring-offset-background ring-offset-2 transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-zinc-500 ${
          selected
            ? "ring-2 ring-zinc-900 dark:ring-zinc-50"
            : "ring-1 ring-zinc-200 group-hover:ring-zinc-400 dark:ring-zinc-700 dark:group-hover:ring-zinc-500"
        }`}
      >
        {selected && (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            <svg viewBox="0 0 20 20" className="h-3 w-3">
              <path
                fill="currentColor"
                d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
              />
            </svg>
          </span>
        )}
      </TemplateMiniCard>
      <span
        className={`truncate text-xs ${
          selected
            ? "font-semibold text-zinc-900 dark:text-zinc-50"
            : "font-medium text-zinc-600 dark:text-zinc-400"
        }`}
      >
        {template.name}
      </span>
    </button>
  );
}

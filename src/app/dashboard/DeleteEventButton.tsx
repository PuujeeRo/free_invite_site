"use client";

import { useTransition } from "react";
import { deleteEvent } from "./actions";

/**
 * Deletes one invitation after a confirmation. A native confirm() on purpose:
 * the action is rare and irreversible, and the browser's own dialog cannot be
 * dismissed by a stray click the way an inline "are you sure" row can.
 */
export function DeleteEventButton({
  eventId,
  label,
  pendingLabel,
  confirmText,
}: {
  eventId: string;
  label: string;
  pendingLabel: string;
  confirmText: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(confirmText)) return;
        startTransition(() => deleteEvent(eventId));
      }}
      className="text-sm font-medium text-red-700 underline underline-offset-4 hover:text-red-900 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
    >
      {isPending ? pendingLabel : label}
    </button>
  );
}

"use client";

import { useActionState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { sendGuestEmail, type SendGuestEmailState } from "./actions";

const initialState: SendGuestEmailState = {};

const ERROR_KEY = {
  not_found: "emailErrorNotFound",
  no_email: "emailErrorNoEmail",
  expired: "emailErrorExpired",
  limit_reached: "emailErrorLimit",
  gmail_reconnect: "emailErrorGmail",
  generic: "emailErrorGeneric",
} as const;

export function SendEmailButton({
  eventId,
  guestId,
  alreadySent,
  viaGmail = false,
}: {
  viaGmail?: boolean; // the organizer has connected their own Gmail
  eventId: string;
  guestId: string;
  alreadySent: boolean;
}) {
  const { dict: t } = useI18n();
  const [state, formAction, isPending] = useActionState(sendGuestEmail, initialState);

  const sent = alreadySent || state.sentGuestId === guestId;

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="guest_id" value={guestId} />
      <button
        type="submit"
        disabled={isPending || sent}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
      >
        {sent
          ? t.eventOverview.emailSent
          : isPending
            ? t.eventOverview.sendingEmail
            : viaGmail
              ? t.eventOverview.sendFromGmail
              : t.eventOverview.sendEmail}
      </button>
      {state.error && (
        <span className="text-xs text-red-600 dark:text-red-400">{t.eventOverview[ERROR_KEY[state.error]]}</span>
      )}
    </form>
  );
}

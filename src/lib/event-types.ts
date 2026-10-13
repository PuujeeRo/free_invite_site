import type { EventType } from "@/lib/supabase/types";

// Keep this in sync with the `event_type` enum (0001_init.sql, extended in
// 0007_more_event_types.sql and 0012_seasonal_event_types.sql).
// labelMn is also spliced into the invitation greeting ("... <labelMn>-д урьж
// байна"), so it has to read as a noun phrase there, not only as a menu label.
// "other" stays last: it is the catch-all, and this order is the picker order.
export const EVENT_TYPES: {
  id: EventType;
  label: string;
  labelMn: string;
}[] = [
  { id: "birthday", label: "Birthday", labelMn: "Төрсөн өдөр" },
  { id: "wedding", label: "Wedding", labelMn: "Хурим" },
  { id: "kids_first_birthday", label: "Kid's 1st Birthday", labelMn: "Хүүхдийн 1 нас" },
  { id: "hair_cutting", label: "First Haircut Ceremony", labelMn: "Даахь үргээх найр" },
  { id: "baby_shower", label: "Newborn Celebration", labelMn: "Хүүхдийн угаалгын найр" },
  { id: "engagement", label: "Engagement", labelMn: "Сүй тавих ёслол" },
  { id: "anniversary", label: "Anniversary", labelMn: "Ойн баяр" },
  { id: "graduation", label: "Graduation", labelMn: "Төгсөлт" },
  { id: "reunion", label: "Class Reunion", labelMn: "Анги хамт олны уулзалт" },
  { id: "housewarming", label: "Housewarming", labelMn: "Шинэ байрны найр" },
  { id: "corporate", label: "Company Event", labelMn: "Байгууллагын арга хэмжээ" },
  { id: "new_year", label: "New Year", labelMn: "Шинэ жил" },
  { id: "tsagaan_sar", label: "Lunar New Year", labelMn: "Цагаан сар" },
  { id: "other", label: "Other", labelMn: "Бусад" },
];

// The service is free and has no guest limit to sell. These are the limits
// that remain, and each is enforced by the database (migration 0014), not only
// by the pages that mention it; scripts/verify-db.ts checks they agree.

// Unpaid, unexpired invitations one organizer may have at a time. Deleting or
// letting one expire frees a place.
export const MAX_LIVE_INVITATIONS = 5;

// Not a product limit and never shown: it only stops a script from filling
// the RSVP table through the public route.
export const RSVP_SAFETY_CEILING = 5000;

// How long an expired invitation is kept before the scheduled cleanup
// (/api/cron/cleanup) deletes it and its images, so the organizer can still
// read the responses for a while after the link has stopped working.
export const EXPIRED_GRACE_DAYS = 7;

export const FREE_PLAN_ACTIVE_DAYS = 7;

// How long a free invitation's link can be set to work, chosen when it is
// created. The shortest is the default (and what the database gives a row that
// says nothing); 30 is the ceiling so that old invitations do not pile up on a
// service that is free to use.
export const LINK_LIFETIME_DAYS = [FREE_PLAN_ACTIVE_DAYS, 14, 30] as const;

export function parseLifetimeDays(value: unknown): number {
  const days = Number(value);
  return (LINK_LIFETIME_DAYS as readonly number[]).includes(days) ? days : FREE_PLAN_ACTIVE_DAYS;
}
export const FREE_EMAIL_SEND_LIMIT = 10;

import type { EventType } from "@/lib/supabase/types";

// Keep this in sync with the `event_type` enum (0001_init.sql, extended in
// 0007_more_event_types.sql and 0012_seasonal_event_types.sql) and the
// enforce_rsvp_limit() trigger (latest definition in 0013_seasonal_event_limits.sql). scripts/verify-db.ts fails if the
// limit here and the limit the trigger enforces ever disagree for any type.
// labelMn is also spliced into the invitation greeting ("... <labelMn>-д урьж
// байна"), so it has to read as a noun phrase there, not only as a menu label.
// "other" stays last: it is the catch-all, and this order is the picker order.
export const EVENT_TYPES: {
  id: EventType;
  label: string;
  labelMn: string;
  freeGuestLimit: 10 | 100;
}[] = [
  { id: "birthday", label: "Birthday", labelMn: "Төрсөн өдөр", freeGuestLimit: 10 },
  { id: "wedding", label: "Wedding", labelMn: "Хурим", freeGuestLimit: 100 },
  { id: "kids_first_birthday", label: "Kid's 1st Birthday", labelMn: "Хүүхдийн 1 нас", freeGuestLimit: 10 },
  { id: "hair_cutting", label: "First Haircut Ceremony", labelMn: "Даахь үргээх найр", freeGuestLimit: 100 },
  { id: "baby_shower", label: "Newborn Celebration", labelMn: "Хүүхдийн угаалгын найр", freeGuestLimit: 10 },
  { id: "engagement", label: "Engagement", labelMn: "Сүй тавих ёслол", freeGuestLimit: 10 },
  { id: "anniversary", label: "Anniversary", labelMn: "Ойн баяр", freeGuestLimit: 10 },
  { id: "graduation", label: "Graduation", labelMn: "Төгсөлт", freeGuestLimit: 100 },
  { id: "reunion", label: "Class Reunion", labelMn: "Анги хамт олны уулзалт", freeGuestLimit: 100 },
  { id: "housewarming", label: "Housewarming", labelMn: "Шинэ байрны найр", freeGuestLimit: 10 },
  { id: "corporate", label: "Company Event", labelMn: "Байгууллагын арга хэмжээ", freeGuestLimit: 100 },
  { id: "new_year", label: "New Year", labelMn: "Шинэ жил", freeGuestLimit: 100 },
  { id: "tsagaan_sar", label: "Lunar New Year", labelMn: "Цагаан сар", freeGuestLimit: 100 },
  { id: "other", label: "Other", labelMn: "Бусад", freeGuestLimit: 10 },
];

export function freeGuestLimitFor(eventType: EventType): 10 | 100 {
  return EVENT_TYPES.find((t) => t.id === eventType)?.freeGuestLimit ?? 10;
}

// Master switch for everything that sells the paid plan: the landing pricing
// section, the upgrade links, the upgrade page and its checkout action. False
// while the product is free for everyone. The payment code itself (providers,
// webhooks, /pay pages) is left intact so flipping this back is the whole job.
// The free-plan LIMITS below are not affected by it and keep applying.
// Typed `boolean`, not the literal `false`, so code behind it stays reachable
// to the type checker and cannot rot while it is switched off.
export const PAYMENTS_ENABLED: boolean = false;

// Whether an event gets the features that used to be sold: accent colour,
// custom greeting line, video, map link and countdown. While there is nothing
// to buy they are open to every event; once payments return they go back to
// paid events only, with no other code to change.
// This is about FEATURES only. The free-plan limits (7-day lifetime, guest
// cap, email cap) and the watermark still follow events.is_paid alone.
export function featuresUnlocked(isPaid: boolean): boolean {
  return isPaid || !PAYMENTS_ENABLED;
}

export const FREE_PLAN_ACTIVE_DAYS = 7;

// How long a free invitation's link can be set to work, chosen when it is
// created. The shortest is the default (and what the database gives a row that
// says nothing); 30 is the ceiling so that old invitations do not pile up on a
// service nobody pays for.
export const LINK_LIFETIME_DAYS = [FREE_PLAN_ACTIVE_DAYS, 14, 30] as const;

export function parseLifetimeDays(value: unknown): number {
  const days = Number(value);
  return (LINK_LIFETIME_DAYS as readonly number[]).includes(days) ? days : FREE_PLAN_ACTIVE_DAYS;
}
export const PAID_PRICE_MNT = 999;
export const FREE_EMAIL_SEND_LIMIT = 10;

import { EVENT_TYPES } from "@/lib/event-types";
import type { EventKind, EventType } from "@/lib/supabase/types";

export function isGreeting(event: { kind?: EventKind | null }): boolean {
  return event.kind === "greeting";
}

// The small line above the name on a greeting card: the occasion, then the
// word for "greeting". Deliberately a label rather than a sentence -- a
// sentence would need the occasion in the genitive ("...-ийн мэнд"), and that
// suffix changes with every label's vowel harmony.
export function buildGreetingCardLine(eventType: EventType): string {
  const typeLabel = EVENT_TYPES.find((t) => t.id === eventType)?.labelMn ?? "Баяр";
  return `${typeLabel} · Мэндчилгээ`;
}

// "Хүндэт Б. Пүрэвсүрэн, таныг [event_name] [event_type]-д урьж байна."
// Falls back to a generic greeting when no guest name was provided.
export function buildGreeting(params: {
  eventName: string;
  eventType: EventType;
  guestFirstName?: string | null;
  guestLastName?: string | null;
}): string {
  const { eventName, eventType, guestFirstName, guestLastName } = params;
  const typeLabel = EVENT_TYPES.find((t) => t.id === eventType)?.labelMn ?? "арга хэмжээ";

  if (guestFirstName) {
    const initial = guestLastName ? `${guestLastName.charAt(0).toUpperCase()}. ` : "";
    return `Хүндэт ${initial}${guestFirstName}, таныг ${eventName} ${typeLabel}-д урьж байна.`;
  }

  return `Таныг ${eventName} ${typeLabel}-д урьж байна.`;
}

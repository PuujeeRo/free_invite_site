// "Add to Google Calendar" link for an invitation.
//
// A plain link to Google's event-template URL rather than an .ics download or
// the Calendar API: it needs no account connection on our side, works from
// inside Messenger's in-app browser (where most guests open invitations), and
// lets the guest review the event before saving it.

// Invitations carry a date and a wall-clock time but no time zone, and every
// event so far is in Mongolia. Passing the zone explicitly makes "18:00" mean
// 18:00 in Ulaanbaatar for a guest whose phone is set to another zone, instead
// of 18:00 wherever they happen to be.
const EVENT_TIME_ZONE = "Asia/Ulaanbaatar";

// Invitations have no end time. Google requires one; three hours is a
// reasonable block for a celebration and is trivially edited by the guest.
const DEFAULT_DURATION_HOURS = 3;

const pad = (n: number) => String(n).padStart(2, "0");

export function buildGoogleCalendarUrl(event: {
  title: string;
  date: string; // YYYY-MM-DD
  time?: string | null; // HH:MM or HH:MM:SS
  location?: string | null;
  description?: string | null;
  invitationUrl?: string | null;
}): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event.date);
  if (!dateMatch) return null;
  const [, y, m, d] = dateMatch.map(Number) as unknown as [number, number, number, number];

  const timeMatch = event.time ? /^(\d{2}):(\d{2})/.exec(event.time) : null;

  // Date arithmetic is done in UTC purely as a calendar calculator (so adding
  // hours or a day rolls over month and year ends correctly); the values are
  // then written out as "floating" local times and pinned to the zone by `ctz`.
  let dates: string;
  if (timeMatch) {
    const start = new Date(Date.UTC(y, m - 1, d, Number(timeMatch[1]), Number(timeMatch[2])));
    const end = new Date(start.getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000);
    const stamp = (t: Date) =>
      `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00`;
    dates = `${stamp(start)}/${stamp(end)}`;
  } else {
    // No time means an all-day event, whose end date is exclusive.
    const start = new Date(Date.UTC(y, m - 1, d));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const day = (t: Date) => `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}`;
    dates = `${day(start)}/${day(end)}`;
  }

  const details = [event.description?.trim(), event.invitationUrl].filter(Boolean).join("\n\n");

  const params = new URLSearchParams({ action: "TEMPLATE", text: event.title, dates, ctz: EVENT_TIME_ZONE });
  if (details) params.set("details", details);
  if (event.location?.trim()) params.set("location", event.location.trim());
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

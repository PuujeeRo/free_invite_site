// Hand-written types for the MVP schema (supabase/migrations/0001_init.sql).
// Swap for generated types later via `supabase gen types typescript`.
//
// These are declared with `type` rather than `interface` on purpose: Supabase's
// generic client constraints check `Row extends Record<string, unknown>`, and
// plain `interface`s (unlike object-literal `type` aliases) don't structurally
// satisfy an index-signature constraint in TS, which silently collapses every
// `.from(...)` call's inferred type to `never`.

export type EventType =
  | "birthday"
  | "wedding"
  | "kids_first_birthday"
  | "hair_cutting"
  | "baby_shower"
  | "engagement"
  | "anniversary"
  | "graduation"
  | "reunion"
  | "housewarming"
  | "corporate"
  | "new_year"
  | "tsagaan_sar"
  | "other";
// An invitation asks guests to RSVP; a greeting is a card sent to one person.
export type EventKind = "invitation" | "greeting";
// Where the cover image sits on the card.
export type CoverLayout = "top" | "bottom" | "full";
export const COVER_LAYOUTS: readonly CoverLayout[] = ["top", "bottom", "full"];
export function parseCoverLayout(value: unknown): CoverLayout {
  return COVER_LAYOUTS.includes(value as CoverLayout) ? (value as CoverLayout) : "top";
}
export type RsvpStatus = "yes" | "no" | "maybe";
export type PaymentProvider = "qpay" | "socialpay" | "stripe" | "mock";
export type PaymentStatus = "pending" | "paid" | "failed";

export type Profile = {
  id: string;
  email: string | null;
  created_at: string;
};

export type EventRow = {
  id: string;
  organizer_id: string;
  // Optional in the type on purpose: both columns arrive with migration 0009,
  // and a row read from a database that has not had it applied yet simply
  // lacks them. Read through isGreeting() rather than comparing directly.
  kind?: EventKind;
  sender_name?: string | null;
  // Optional for the same reason as the two above; arrives with migration
  // 0010. Read through parseCoverLayout(), which treats "missing" as "top".
  cover_layout?: CoverLayout;
  // Migration 0011. Read through readGallery() (lib/gallery.ts).
  gallery_urls?: string[];
  event_type: EventType;
  // The event's name for an invitation; the recipient's name for a greeting.
  name: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  photo_url: string | null;
  description: string | null;
  template_id: string;
  theme: Record<string, unknown>;
  custom_text: Record<string, unknown>;
  video_url: string | null;
  map_link: string | null;
  countdown_enabled: boolean;
  slug: string;
  is_paid: boolean;
  paid_at: string | null;
  created_at: string;
  expires_at: string;
};

export type NamedGuestRow = {
  id: string;
  event_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  guest_token: string;
  email_sent_at: string | null;
  created_at: string;
};

export type RsvpRow = {
  id: string;
  event_id: string;
  device_guest_id: string;
  named_guest_id: string | null;
  display_name: string | null;
  status: RsvpStatus;
  party_size: number;
  created_at: string;
  updated_at: string;
};

import type { CheckoutPayload } from "@/lib/payments/types";

export type PaymentRow = {
  id: string;
  event_id: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  provider_ref: string | null;
  // Provider-rendered checkout material (QPay QR + bank deeplinks). See
  // CheckoutPayload in lib/payments/types and migration 0004. Null for
  // providers that hand back a hosted checkout page instead.
  checkout: CheckoutPayload | null;
  created_at: string;
  paid_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      events: {
        Row: EventRow;
        Insert: Partial<EventRow> & Pick<EventRow, "organizer_id" | "event_type" | "name" | "event_date" | "slug">;
        Update: Partial<EventRow>;
        Relationships: [];
      };
      named_guests: {
        Row: NamedGuestRow;
        Insert: Partial<NamedGuestRow> & Pick<NamedGuestRow, "event_id">;
        Update: Partial<NamedGuestRow>;
        Relationships: [];
      };
      rsvps: {
        Row: RsvpRow;
        Insert: Partial<RsvpRow> & Pick<RsvpRow, "event_id" | "device_guest_id" | "status">;
        Update: Partial<RsvpRow>;
        Relationships: [];
      };
      payments: {
        Row: PaymentRow;
        Insert: Partial<PaymentRow> & Pick<PaymentRow, "event_id">;
        Update: Partial<PaymentRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

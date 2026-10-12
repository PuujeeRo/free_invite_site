import type { CoverLayout, EventKind, EventType } from "@/lib/supabase/types";
import type { CardEffect, CoverBackground } from "@/lib/theme";

// The unsaved invitation as the new-invitation form currently holds it. The
// form writes this to localStorage on every change and /preview renders it, so
// the organizer can look at the real guest page before anything is created.
//
// localStorage (not a query string, not the database) on purpose:
//   - nothing is saved server-side, so a preview can never leak or linger;
//   - the cover is a blob: URL, which only resolves in this browser while the
//     form's tab is still open -- it could not be put in a shareable link anyway;
//   - other tabs get a `storage` event on every write, which is what lets an
//     open preview tab follow the form live.
export const PREVIEW_DRAFT_KEY = "naashir_preview_draft";

export interface PreviewDraft {
  kind: EventKind;
  eventType: EventType;
  name: string;
  senderName: string;
  date: string;
  time: string;
  location: string;
  mapLink: string;
  description: string;
  templateId: string;
  photoUrl: string | null;
  coverLayout: CoverLayout;
  coverBackground: CoverBackground;
  coverIcon: string | null;
  gallery: string[];
  effect: CardEffect;
}

export function parsePreviewDraft(raw: string | null): PreviewDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PreviewDraft> | null;
    // Only the fields the card cannot render without are checked; this is the
    // organizer's own browser storage, not an untrusted boundary.
    if (!value || typeof value.templateId !== "string" || typeof value.eventType !== "string") {
      return null;
    }
    return value as PreviewDraft;
  } catch {
    return null;
  }
}

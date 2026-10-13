"use client";

import { useEffect } from "react";
import { getOrCreateGuestDeviceId } from "@/lib/guest-device-id";

/**
 * Counts an invitation's audience from the guest page: one "view" when the
 * page is opened, and a click whenever the map or calendar button is used.
 * Renders nothing.
 *
 * Counting is per device, with the same id the RSVP uses, so the organizer's
 * "opened by" and "answered by" numbers are measured the same way.
 *
 * The buttons live in InvitationCard, a server component shared with the demo
 * and the landing page. Rather than making that card a client component for
 * the sake of one page, it marks its links with data-track and this listens
 * for clicks on them from the document.
 */
export function ViewTracker({ eventId }: { eventId: string }) {
  useEffect(() => {
    let deviceId = "";
    try {
      deviceId = getOrCreateGuestDeviceId();
    } catch {
      return; // storage blocked: this visitor is not counted
    }
    if (!deviceId) return;

    const send = (kind: "view" | "map" | "calendar") => {
      const body = JSON.stringify({ event_id: eventId, device_id: deviceId, kind });
      // sendBeacon survives the page being left, which is exactly what a click
      // on an outgoing link does.
      if (!navigator.sendBeacon?.("/api/track", body)) {
        void fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
      }
    };

    // Once per tab session per invitation: a reload, or React running this
    // effect twice in development, is not a second visit.
    const seenKey = `naashir_viewed_${eventId}`;
    try {
      if (!window.sessionStorage.getItem(seenKey)) {
        window.sessionStorage.setItem(seenKey, "1");
        send("view");
      }
    } catch {
      send("view");
    }

    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[data-track]");
      const kind = link?.getAttribute("data-track");
      if (kind === "map" || kind === "calendar") send(kind);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [eventId]);

  return null;
}

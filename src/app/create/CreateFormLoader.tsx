"use client";

import { useEffect, useSyncExternalStore } from "react";
import { NewEventForm } from "@/app/dashboard/new/NewEventForm";
import { CREATE_STASH_KEY, parseCreateStash } from "@/lib/create-stash";

// What was parked in the browser before the trip to the login page, read once.
// Cached at module level so the value the form was built from stays put after
// the form clears the stored copy; reading storage afresh on every render
// would flip it back to "nothing" and remount the form empty.
let cachedRaw: string | null | undefined;

function readStash(): string | null {
  if (cachedRaw === undefined) {
    try {
      cachedRaw = window.localStorage.getItem(CREATE_STASH_KEY);
    } catch {
      cachedRaw = null;
    }
  }
  return cachedRaw;
}

const subscribe = () => () => {};

/**
 * Hands the new-invitation form whatever the visitor had typed before signing
 * in. The server cannot see browser storage, so the first render is always the
 * empty form; once the stash is known the form is remounted with it (the `key`
 * change), which is what lets every field start from the restored value.
 */
export function CreateFormLoader({ signedIn, atLiveLimit }: { signedIn: boolean; atLiveLimit: boolean }) {
  const raw = useSyncExternalStore(subscribe, readStash, () => null);
  const stash = parseCreateStash(raw);

  // Forget the cached copy when the page is left, so a later visit reads
  // storage again instead of resurrecting a stash the form has since cleared
  // (it clears it when a signed-in visitor submits).
  useEffect(
    () => () => {
      cachedRaw = undefined;
    },
    []
  );

  return (
    <NewEventForm key={stash ? "restored" : "fresh"} signedIn={signedIn} atLiveLimit={atLiveLimit} initial={stash} />
  );
}

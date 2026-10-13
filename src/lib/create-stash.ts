// What a visitor typed into the new-invitation form before they had signed in.
//
// The form is open to everyone; signing in is asked for only at the moment of
// creating. The fields are parked here across the trip to the login page and
// back, so the visitor returns to the form as they left it.
//
// localStorage, so it survives the magic link opening a new tab in the same
// browser. It does not follow them to another browser or device, and the cover
// image cannot be stored at all (a File is not serialisable) -- the form says
// so when it restores.
export const CREATE_STASH_KEY = "naashir_create_stash";

// Long enough to find the email and click the link; short enough that a
// forgotten draft does not reappear days later on a shared computer.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type CreateStash = Record<string, string>;

export function writeCreateStash(form: HTMLFormElement): void {
  const fields: CreateStash = {};
  for (const [key, value] of new FormData(form).entries()) {
    // Skips the cover file, and the hidden $ACTION_* fields React adds to a
    // form that has a server action: those belong to one render of the page.
    if (typeof value === "string" && !key.startsWith("$")) fields[key] = value;
  }
  try {
    window.localStorage.setItem(CREATE_STASH_KEY, JSON.stringify({ savedAt: Date.now(), fields }));
  } catch {
    // Storage unavailable: the visitor signs in and starts again from empty.
  }
}

export function parseCreateStash(raw: string | null): CreateStash | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { savedAt?: unknown; fields?: unknown } | null;
    if (!value || typeof value.savedAt !== "number" || Date.now() - value.savedAt > MAX_AGE_MS) return null;
    if (!value.fields || typeof value.fields !== "object") return null;
    const fields: CreateStash = {};
    for (const [key, field] of Object.entries(value.fields)) {
      if (typeof field === "string") fields[key] = field;
    }
    return fields;
  } catch {
    return null;
  }
}

export function clearCreateStash(): void {
  try {
    window.localStorage.removeItem(CREATE_STASH_KEY);
  } catch {
    // Nothing to clear.
  }
}

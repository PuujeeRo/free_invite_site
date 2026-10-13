import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isLocalDevMode } from "@/lib/supabase/local-dev";
import { EVENT_MEDIA_BUCKET } from "@/lib/storage";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Deletes invitations together with the images uploaded for them.
 *
 * Deleting the row alone would leave its cover in storage for good: nothing
 * else refers to the file, so nothing would ever find it again. Guests, RSVPs,
 * views and payments go with the row through their foreign keys.
 *
 * Takes the service-role client: storage deletes are not open to organizers,
 * and the scheduled cleanup has no session at all. Callers are responsible for
 * having established that these events may be deleted.
 */
export async function deleteEventsWithMedia(
  admin: SupabaseClient<Database>,
  events: { id: string; organizer_id: string }[]
): Promise<{ deleted: number; filesRemoved: number }> {
  let filesRemoved = 0;
  const deletable: string[] = [];

  for (const event of events) {
    // The ids become a storage path, and on local dev a filesystem path.
    if (!UUID.test(event.id) || !UUID.test(event.organizer_id)) continue;
    const folder = `${event.organizer_id}/${event.id}`;

    try {
      filesRemoved += isLocalDevMode() ? await removeLocalFolder(folder) : await removeBucketFolder(admin, folder);
      deletable.push(event.id);
    } catch {
      // Leave the row in place: it is the only record of where the files are,
      // and the next run will try again.
    }
  }

  if (deletable.length === 0) return { deleted: 0, filesRemoved };

  const { error, count } = await admin.from("events").delete({ count: "exact" }).in("id", deletable);
  if (error) throw error;
  return { deleted: count ?? deletable.length, filesRemoved };
}

// Covers are stored flat under <organizer>/<event>/ (see eventMediaPath).
async function removeBucketFolder(admin: SupabaseClient<Database>, folder: string): Promise<number> {
  const bucket = admin.storage.from(EVENT_MEDIA_BUCKET);
  let removed = 0;
  // An organizer can replace the cover many times; each upload is a new file.
  for (let page = 0; page < 20; page++) {
    const { data, error } = await bucket.list(folder, { limit: 100 });
    if (error) throw error;
    if (!data || data.length === 0) break;
    const { error: removeError } = await bucket.remove(data.map((file) => `${folder}/${file.name}`));
    if (removeError) throw removeError;
    removed += data.length;
    if (data.length < 100) break;
  }
  return removed;
}

async function removeLocalFolder(folder: string): Promise<number> {
  const { readdir, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const dir = join(process.cwd(), "public", "uploads", folder);
  const files = await readdir(dir).catch(() => [] as string[]);
  await rm(dir, { recursive: true, force: true });
  return files.length;
}

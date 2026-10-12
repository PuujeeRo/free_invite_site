"use client";

import { useEffect, useRef, useState } from "react";
import { COVER_ACCEPT, precheckCoverFile, withCoverLimits, type CoverRejection } from "@/lib/cover-media";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Cover picker for the invitation card: file input, live preview, and instant
 * feedback on an unsupported or oversized file.
 *
 * The preview is a plain <img>, not next/image, deliberately. next/image would
 * need width/height (unknown before the user picks) and its optimizer flattens
 * an animated GIF to its first frame -- which would make the preview lie about
 * exactly the thing the user is checking. The invitation card itself renders
 * the stored cover with `unoptimized` for the same reason.
 */
export function CoverImageField({
  currentUrl,
  onPreviewChange,
}: {
  currentUrl?: string | null;
  // Reports the blob URL of the accepted file (or null when cleared/rejected)
  // so a parent can show it in a larger preview. The URL is owned and revoked
  // here; a parent must only ever render the latest value it was given.
  onPreviewChange?: (url: string | null) => void;
}) {
  const { dict: t } = useI18n();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejection, setRejection] = useState<CoverRejection | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The saved cover has been taken off. Submitted as `remove_photo`, which the
  // edit action honours only when no new file comes with it.
  const [removed, setRemoved] = useState(false);

  // Object URLs are a manual resource: without the revoke the blob is pinned in
  // memory for the life of the document, and picking a few large GIFs in a row
  // would leak every one of them.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // No manual revoke here: the effect above already revokes whatever URL is
    // being replaced, including on the clear-to-null paths below.
    setPreviewUrl(null);
    onPreviewChange?.(null);

    if (!file) {
      setRejection(null);
      return;
    }

    const problem = precheckCoverFile(file);
    setRejection(problem);

    if (problem) {
      // Clear the input so a rejected file is never submitted: the server
      // re-validates regardless, but leaving it selected invites the user to
      // hit save and get a second, slower rejection for something we already
      // know is wrong.
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onPreviewChange?.(url);
  }

  // Takes off whichever image is showing: a file just picked is un-picked
  // (the saved cover, if any, comes back), a saved cover is marked for removal.
  function remove() {
    if (previewUrl) {
      if (inputRef.current) inputRef.current.value = "";
      setPreviewUrl(null);
      onPreviewChange?.(null);
    } else {
      setRemoved(true);
    }
    setRejection(null);
  }

  const shown = previewUrl ?? (removed ? null : currentUrl) ?? null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {t.newEvent.photoLabel}
      </span>

      {shown && (
        <div className="relative w-full max-w-56 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element -- see component doc: a blob: preview has no known dimensions, and the optimizer would freeze an animated GIF */}
          <img src={shown} alt="" className="aspect-4/3 w-full object-cover" />
          {!previewUrl && (
            <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {t.newEvent.photoCurrent}
            </span>
          )}
          <button
            type="button"
            onClick={remove}
            className="absolute top-1 right-1 rounded-md bg-black/65 px-2 py-1 text-[11px] font-medium text-white hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            {t.newEvent.photoRemove}
          </button>
        </div>
      )}
      {removed && <input type="hidden" name="remove_photo" value="1" />}

      {/* The native control already shows the chosen filename, so this
          component deliberately doesn't print it a second time. */}
      <input
        ref={inputRef}
        type="file"
        name="photo"
        accept={COVER_ACCEPT}
        onChange={onChange}
        className="text-sm"
      />

      {rejection ? (
        <p className="text-xs text-red-600 dark:text-red-400">
          {rejection === "type" ? t.newEvent.photoErrorType : withCoverLimits(t.newEvent.photoErrorSize)}
        </p>
      ) : (
        <p className="text-xs text-zinc-500">{withCoverLimits(t.newEvent.photoHint)}</p>
      )}
    </div>
  );
}

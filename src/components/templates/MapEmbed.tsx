// Pinned OpenStreetMap shown under an invitation. `src` comes from
// buildMapEmbedUrl (lib/map-embed.ts), which only ever produces an
// https://www.openstreetmap.org/export/embed.html?... address.
export function MapEmbed({ src, title }: { src: string; title: string }) {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <iframe
        src={src}
        title={title}
        // Below the card on a page most guests open on mobile data: do not
        // fetch map tiles until the map is about to scroll into view.
        loading="lazy"
        className="block h-56 w-full border-0 sm:h-64"
      />
      {/* OpenStreetMap's licence requires visible attribution wherever its
          map is shown. */}
      <p className="px-3 py-1.5 text-right text-[10px] text-zinc-500">
        ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          OpenStreetMap
        </a>
      </p>
    </div>
  );
}

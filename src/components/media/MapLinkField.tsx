"use client";

import { useEffect, useRef, useState } from "react";
import { extractCoords, osmLink, parseRawCoords, type Coords } from "@/lib/map-embed";
import { useI18n } from "@/i18n/I18nProvider";

const TILE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 19;
const ULAANBAATAR: Coords = { lat: 47.9185, lng: 106.9177 };

// Web Mercator, the projection OpenStreetMap's tiles are cut in: a position on
// the globe to a pixel on the whole-world image at a zoom level, and back.
function toPixel({ lat, lng }: Coords, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function toCoords(x: number, y: number, zoom: number): Coords {
  const scale = TILE * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return {
    lat: Math.max(-85, Math.min(85, (180 / Math.PI) * Math.atan(Math.sinh(n)))),
    lng: ((((x / scale) * 360 - 180 + 180) % 360) + 360) % 360 - 180,
  };
}

/**
 * The map-link field, with a way to choose the place without leaving the page.
 * Submits as `map_link`, exactly like the plain input it replaces: a pasted
 * link still works, and picking a spot simply writes an OpenStreetMap link
 * into the same box.
 */
export function MapLinkField({
  label,
  hint,
  defaultValue = "",
  inputClass,
}: {
  label: string;
  hint: string;
  defaultValue?: string;
  inputClass: string;
}) {
  const { dict: t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  // Where the picker opens: on whatever the box already points at, if anything.
  const [start, setStart] = useState<{ coords: Coords; zoom: number; pinned: boolean }>({
    coords: ULAANBAATAR,
    zoom: 13,
    pinned: false,
  });

  function openPicker() {
    const current = inputRef.current?.value ?? "";
    const coords = parseRawCoords(current) ?? extractCoords(current);
    setStart(coords ? { coords, zoom: 16, pinned: true } : { coords: ULAANBAATAR, zoom: 13, pinned: false });
    setOpen(true);
  }

  function pick(coords: Coords) {
    const input = inputRef.current;
    if (!input) return;
    const rounded = { lat: Number(coords.lat.toFixed(6)), lng: Number(coords.lng.toFixed(6)) };
    // Through the element's own setter, then a real `input` event: React
    // ignores a value assigned directly, and the form listens for changes to
    // refresh its live preview.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, osmLink(rounded));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
        <input
          ref={inputRef}
          name="map_link"
          defaultValue={defaultValue}
          maxLength={500}
          placeholder="https://maps.app.goo.gl/..."
          className={inputClass}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="text-xs text-zinc-500">{hint}</span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openPicker())}
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
        >
          {open ? t.newEvent.mapPinClose : t.newEvent.mapPinOpen}
        </button>
      </div>
      {open && <PinMap start={start.coords} startZoom={start.zoom} startPinned={start.pinned} onPick={pick} />}
    </div>
  );
}

// A small map to drop a pin on: a click or tap places the pin and writes the
// link straight away, a drag moves the map. An earlier version kept the pin
// fixed at the centre and had the map moved under it, with a confirm button;
// people clicked the map expecting a pin and concluded it could not be done.
// Drawn from OpenStreetMap's tiles directly, so no map library is loaded.
function PinMap({
  start,
  startZoom,
  startPinned,
  onPick,
}: {
  start: Coords;
  startZoom: number;
  startPinned: boolean;
  onPick: (coords: Coords) => void;
}) {
  const { dict: t } = useI18n();
  const boxRef = useRef<HTMLDivElement>(null);
  // `travelled` tells a click from a drag when the pointer comes back up.
  const drag = useRef<{ x: number; y: number; travelled: number } | null>(null);
  const [center, setCenter] = useState(start);
  const [pin, setPin] = useState<Coords | null>(startPinned ? start : null);
  const [zoom, setZoom] = useState(startZoom);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(() => setSize({ width: box.clientWidth, height: box.clientHeight }));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const mid = toPixel(center, zoom);
  const left = mid.x - size.width / 2;
  const top = mid.y - size.height / 2;
  const perSide = 2 ** zoom;
  const pinAt = pin ? toPixel(pin, zoom) : null;
  const tiles: { key: string; src: string; x: number; y: number }[] = [];
  if (size.width > 0) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.height) / TILE); ty++) {
      if (ty < 0 || ty >= perSide) continue; // nothing above or below the world
      for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.width) / TILE); tx++) {
        const wrapped = ((tx % perSide) + perSide) % perSide; // the world repeats sideways
        tiles.push({
          key: `${zoom}/${tx}/${ty}`,
          src: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${ty}.png`,
          x: Math.round(tx * TILE - left),
          y: Math.round(ty * TILE - top),
        });
      }
    }
  }

  const zoomButton =
    "flex h-9 w-9 items-center justify-center bg-white text-lg leading-none text-zinc-900 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:outline-none disabled:opacity-40";

  return (
    <div className="mt-1 flex flex-col gap-2">
      <div
        ref={boxRef}
        className="relative h-64 cursor-grab touch-none overflow-hidden rounded-xl border border-zinc-300 bg-zinc-200 select-none active:cursor-grabbing dark:border-zinc-700"
        onPointerDown={(e) => {
          if (e.button !== 0 || (e.target as HTMLElement).closest("button, a")) return;
          drag.current = { x: e.clientX, y: e.clientY, travelled: 0 };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const last = drag.current;
          if (!last) return;
          const dx = e.clientX - last.x;
          const dy = e.clientY - last.y;
          drag.current = { x: e.clientX, y: e.clientY, travelled: last.travelled + Math.abs(dx) + Math.abs(dy) };
          setCenter((current) => {
            const p = toPixel(current, zoom);
            return toCoords(p.x - dx, p.y - dy, zoom);
          });
        }}
        onPointerUp={(e) => {
          const last = drag.current;
          drag.current = null;
          if (!last || last.travelled > 6) return; // that was a drag
          const box = e.currentTarget.getBoundingClientRect();
          const spot = toCoords(left + e.clientX - box.left, top + e.clientY - box.top, zoom);
          setPin(spot);
          onPick(spot);
        }}
        onPointerCancel={() => (drag.current = null)}
      >
        {tiles.map((tile) => (
          // Plain <img>: these are third-party map tiles at a fixed 256px, and
          // there are dozens of them changing on every drag.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={tile.key}
            src={tile.src}
            alt=""
            width={TILE}
            height={TILE}
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{ left: tile.x, top: tile.y }}
          />
        ))}

        {/* The pin's tip, not its middle, marks the spot. */}
        {pinAt && (
          <svg
            viewBox="0 0 24 34"
            aria-hidden="true"
            className="pointer-events-none absolute h-10 w-7 -translate-x-1/2 -translate-y-full drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)]"
            style={{ left: pinAt.x - left, top: pinAt.y - top }}
          >
            <path d="M12 33 C 12 33, 1 19, 1 12 A 11 11 0 0 1 23 12 C 23 19, 12 33, 12 33 Z" fill="#dc2626" stroke="#fff" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="4" fill="#fff" />
          </svg>
        )}

        <div className="absolute top-2 right-2 flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-300 shadow-sm">
          <button
            type="button"
            aria-label={t.newEvent.mapPinZoomIn}
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}
            className={zoomButton}
          >
            +
          </button>
          <button
            type="button"
            aria-label={t.newEvent.mapPinZoomOut}
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}
            className={zoomButton}
          >
            −
          </button>
        </div>

        {/* Required by OpenStreetMap's licence wherever its map is shown. */}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="absolute right-0 bottom-0 rounded-tl bg-white/85 px-1.5 py-0.5 text-[10px] text-zinc-700 visited:text-zinc-700"
        >
          © OpenStreetMap
        </a>
      </div>
      <span className="text-xs text-pretty text-zinc-500">{pin ? t.newEvent.mapPinDone : t.newEvent.mapPinHint}</span>
    </div>
  );
}

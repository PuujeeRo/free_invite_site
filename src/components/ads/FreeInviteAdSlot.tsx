import { getAdSenseConfig } from "@/lib/ads/config";
import { AdSenseScript } from "./AdSenseScript";
import { AdSlot } from "./AdSlot";

// Shown on invitation pages below the RSVP card -- never next to the
// Yes/No/Maybe buttons (accidental-click risk, and AdSense policy disallows
// ads placed to encourage that). Every invitation is free now, so every
// invitation page shows it.
export function FreeInviteAdSlot() {
  const config = getAdSenseConfig();

  if (!config) {
    // No AdSense account configured yet. Render nothing in production; in dev,
    // show where the slot would sit so the layout can be checked without one.
    if (process.env.NODE_ENV === "production") return null;
    return (
      <div className="flex w-full max-w-md items-center justify-center rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-xs text-zinc-400 dark:border-zinc-700">
        Ad slot (set NEXT_PUBLIC_ADSENSE_CLIENT_ID / NEXT_PUBLIC_ADSENSE_INVITE_SLOT_ID to enable)
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <AdSenseScript clientId={config.clientId} />
      <AdSlot clientId={config.clientId} slotId={config.inviteSlotId} />
    </div>
  );
}

import type { Metadata } from "next";
import { TopControls } from "@/components/theme/TopControls";
import { HeaderRow } from "@/components/layout/HeaderRow";
import { PreviewClient } from "./PreviewClient";

// A private scratch view of an unsaved draft: nothing here should be indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Same shell as the real guest page (app/i/[slug]/page.tsx); the content comes
// from the browser's own storage, so there is nothing to fetch on the server.
export default function PreviewPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="px-4 py-3">
        <HeaderRow maxWidth="md" justify="end">
          <TopControls />
        </HeaderRow>
      </header>
      <PreviewClient />
    </div>
  );
}

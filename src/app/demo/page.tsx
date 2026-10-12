import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { TopControls } from "@/components/theme/TopControls";
import { AccountButton } from "@/components/account/AccountButton";
import { HeaderRow } from "@/components/layout/HeaderRow";
import { DemoClient } from "./DemoClient";

export default function DemoPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-background">
      <header className="px-4 py-3">
        <HeaderRow maxWidth="3xl">
          {/* The demo used to have only the controls on the right, so the one
              way back to the home page was the browser's back button. */}
          <Link
            href="/"
            className="rounded text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-zinc-50 dark:focus-visible:ring-zinc-100"
          >
            <Logo markClassName="h-5 w-5" textClassName="text-base sm:text-lg" />
          </Link>
          <div className="flex items-center gap-2">
            <TopControls />
            <AccountButton />
          </div>
        </HeaderRow>
      </header>
      <DemoClient />
    </div>
  );
}

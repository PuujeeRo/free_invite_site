import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { TopControls } from "@/components/theme/TopControls";
import { AccountButton } from "@/components/account/AccountButton";
import { HeaderRow } from "@/components/layout/HeaderRow";

/** Header for pages anyone can open: logo home, the controls, and the account button when signed in. */
export function PublicHeader({ maxWidth = "3xl" }: { maxWidth?: React.ComponentProps<typeof HeaderRow>["maxWidth"] }) {
  return (
    <header className="px-4 py-3">
      <HeaderRow maxWidth={maxWidth}>
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
  );
}

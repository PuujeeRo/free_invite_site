import { LocaleSwitcher } from "@/i18n/LocaleSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { TipButton } from "@/components/tip/TipButton";

export function TopControls() {
  return (
    <div className="flex items-center gap-2">
      <TipButton />
      <LocaleSwitcher />
      <ThemeToggle />
    </div>
  );
}

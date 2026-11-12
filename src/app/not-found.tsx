import Link from "next/link";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import { AstronautIllustration } from "@/components/illustrations/AstronautIllustration";

const STARS = [
  { top: "8%", left: "12%", size: 2, delay: "0s" },
  { top: "18%", left: "82%", size: 3, delay: "0.4s" },
  { top: "30%", left: "6%", size: 2, delay: "0.9s" },
  { top: "12%", left: "48%", size: 2, delay: "1.3s" },
  { top: "40%", left: "90%", size: 2, delay: "0.2s" },
  { top: "62%", left: "10%", size: 3, delay: "1.6s" },
  { top: "72%", left: "85%", size: 2, delay: "0.7s" },
  { top: "85%", left: "30%", size: 2, delay: "1.1s" },
  { top: "80%", left: "60%", size: 3, delay: "0.5s" },
  { top: "50%", left: "50%", size: 2, delay: "1.8s" },
  { top: "22%", left: "68%", size: 2, delay: "1.0s" },
  { top: "6%", left: "70%", size: 2, delay: "1.4s" },
];

export default async function NotFound() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-white px-6 py-16 text-center dark:from-indigo-950/60 dark:via-background dark:to-background">
      <div className="pointer-events-none absolute inset-0">
        {STARS.map((star, i) => (
          <span
            key={i}
            className="animate-twinkle absolute rounded-full bg-indigo-400 dark:bg-white"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              animationDelay: star.delay,
            }}
          />
        ))}
      </div>

      <div className="animate-float relative w-48 sm:w-56">
        <AstronautIllustration className="w-full" />
      </div>

      <p className="relative mt-4 text-6xl font-bold tracking-tight text-indigo-950 sm:text-7xl dark:text-white">
        {t.notFoundPage.code}
      </p>
      <h1 className="relative mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        {t.notFoundPage.title}
      </h1>
      <p className="relative mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        {t.notFoundPage.subtitle}
      </p>

      <Link
        href="/"
        className="relative mt-8 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white visited:text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:visited:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {t.notFoundPage.backHome}
      </Link>
    </div>
  );
}

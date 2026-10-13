import type { Metadata } from "next";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import { PageContainer } from "@/components/layout/PageContainer";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { recentSupporters, tipBankDetails, tipsOnline } from "@/lib/tips";
import { TipForm } from "./TipForm";

export const metadata: Metadata = { title: "Naashir · Tip" };

// Reads the supporters list and the payment configuration on every request.
export const dynamic = "force-dynamic";

export default async function TipPage({ searchParams }: { searchParams: Promise<{ thanks?: string }> }) {
  const { thanks } = await searchParams;
  const t = getDictionary(await getLocale());
  const online = tipsOnline();
  const bank = tipBankDetails();
  const supporters = await recentSupporters();

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader maxWidth="lg" />
      <PageContainer maxWidth="lg">
        <h1 className="font-display text-2xl font-medium tracking-tight text-balance text-zinc-900 sm:text-3xl dark:text-zinc-50">
          {t.tip.title}
        </h1>
        <p className="mt-2 max-w-[60ch] text-sm text-pretty text-zinc-600 dark:text-zinc-400">{t.tip.subtitle}</p>

        {thanks === "1" && (
          <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            {t.tip.thanksTitle} {t.tip.thanksBody}
          </p>
        )}

        <div className="mt-8">
          {online ? (
            <TipForm />
          ) : bank ? (
            // No QPay merchant account yet: a transfer still gets there.
            <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.tip.bankTitle}</h2>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-zinc-500">{t.tip.bankName}</dt>
                <dd className="text-zinc-900 dark:text-zinc-50">{bank.bank}</dd>
                <dt className="text-zinc-500">{t.tip.bankAccount}</dt>
                <dd className="font-medium text-zinc-900 tabular-nums select-all dark:text-zinc-50">{bank.account}</dd>
                {bank.holder && (
                  <>
                    <dt className="text-zinc-500">{t.tip.bankHolder}</dt>
                    <dd className="text-zinc-900 dark:text-zinc-50">{bank.holder}</dd>
                  </>
                )}
              </dl>
              <p className="mt-3 text-xs text-zinc-500">{t.tip.bankHint}</p>
            </div>
          ) : (
            <p className="rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {t.tip.unavailable}
            </p>
          )}
        </div>

        {supporters.length > 0 && (
          <section className="mt-12">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.tip.supportersTitle}</h2>
            <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
              {supporters.map((supporter, i) => (
                <li key={i} className="py-3">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{supporter.name}</p>
                  {supporter.message && (
                    <p className="mt-0.5 text-sm text-pretty text-zinc-600 dark:text-zinc-400">{supporter.message}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </PageContainer>
    </div>
  );
}

import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import { PageContainer } from "@/components/layout/PageContainer";
import { NewEventForm } from "./NewEventForm";

export default async function NewEventPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  // Wider than a normal form screen: the form sits beside a full-size live
  // preview. max-w-6xl is not one of PageContainer's standard widths, so the
  // container is opened to its widest and capped here instead.
  return (
    <PageContainer maxWidth="3xl">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t.newEvent.title}</h1>
        <div className="mt-8">
          <NewEventForm />
        </div>
      </div>
    </PageContainer>
  );
}

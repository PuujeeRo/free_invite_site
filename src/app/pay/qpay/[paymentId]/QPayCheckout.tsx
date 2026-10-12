"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CheckoutDeeplink } from "@/lib/payments/types";

type Status = "waiting" | "paid" | "timedout" | "error";

const POLL_INTERVAL_MS = 3_000;
// QPay invoices are short-lived, and a payer who has not finished in 15 minutes
// has almost certainly abandoned the tab. Stopping keeps an idle tab from
// polling the merchant API forever.
const POLL_WINDOW_MS = 15 * 60 * 1000;

export function QPayCheckout({
  paymentId,
  eventId,
  qrImage,
  shortUrl,
  deeplinks,
  labels,
}: {
  paymentId: string;
  eventId: string;
  qrImage: string | null;
  shortUrl: string | null;
  deeplinks: CheckoutDeeplink[];
  labels: {
    scanTitle: string;
    scanBody: string;
    openBank: string;
    waiting: string;
    paidTitle: string;
    paidBody: string;
    backToEvent: string;
    timedout: string;
    checkAgain: string;
    error: string;
    openInQpay: string;
  };
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("waiting");
  const [checking, setChecking] = useState(false);
  // Set in the effect below, not here: reading the clock during render is
  // impure and would drift on every re-render.
  const startedAt = useRef(0);
  const settled = useRef(false);

  const check = useCallback(
    async (signal?: AbortSignal) => {
      if (settled.current) return;
      setChecking(true);
      try {
        const res = await fetch(`/api/payments/qpay/check?payment_id=${paymentId}`, {
          signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error("check_failed");
        const json = (await res.json()) as { status?: string };
        if (json.status === "paid") {
          settled.current = true;
          setStatus("paid");
          // Let the confirmation land before moving on, then send the organizer
          // back to the event they just unlocked.
          setTimeout(() => router.replace(`/dashboard/${eventId}`), 1800);
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setStatus((current) => (current === "waiting" ? "error" : current));
      } finally {
        setChecking(false);
      }
    },
    [paymentId, eventId, router]
  );

  useEffect(() => {
    const controller = new AbortController();
    startedAt.current = Date.now();

    const interval = setInterval(() => {
      if (settled.current) return;
      if (Date.now() - startedAt.current > POLL_WINDOW_MS) {
        settled.current = true;
        setStatus("timedout");
        return;
      }
      void check(controller.signal);
    }, POLL_INTERVAL_MS);

    // The moment that actually matters: the payer tapped a bank deeplink, paid
    // in that app, and just came back to this tab. Check immediately rather
    // than making them wait out the rest of the interval.
    const onVisible = () => {
      if (document.visibilityState === "visible" && !settled.current) {
        void check(controller.signal);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      controller.abort();
    };
  }, [check]);

  if (status === "paid") {
    return (
      <div className="motion-safe:animate-fade-in-up rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center dark:border-emerald-900 dark:bg-emerald-950/50">
        <p className="text-4xl" aria-hidden="true">
          🎉
        </p>
        <h2 className="mt-3 text-lg font-semibold text-emerald-900 dark:text-emerald-100">
          {labels.paidTitle}
        </h2>
        <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">{labels.paidBody}</p>
        <a
          href={`/dashboard/${eventId}`}
          className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
        >
          {labels.backToEvent}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {qrImage ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800">
          {/* Kept on white in both themes: a QR inverted for dark mode is a QR
              a banking app will not read. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${qrImage}`}
            alt={labels.scanTitle}
            width={224}
            height={224}
            className="mx-auto h-56 w-56 rounded-lg object-contain"
          />
          <h2 className="mt-5 text-sm font-semibold text-zinc-900">{labels.scanTitle}</h2>
          <p className="mx-auto mt-1 max-w-[34ch] text-sm text-zinc-600">{labels.scanBody}</p>
        </div>
      ) : shortUrl ? (
        <a
          href={shortUrl}
          target="_blank"
          rel="noreferrer"
          className="block rounded-2xl border border-zinc-200 bg-white px-6 py-8 text-center text-sm font-medium text-zinc-900 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:border-zinc-600"
        >
          {labels.openInQpay}
        </a>
      ) : null}

      {deeplinks.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {labels.openBank}
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {deeplinks.map((bank) => (
              <li key={bank.link}>
                <a
                  href={bank.link}
                  className="flex h-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-2.5 text-[11px] leading-tight font-medium text-zinc-900 transition-transform hover:border-zinc-400 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:border-zinc-600 dark:focus-visible:ring-zinc-100"
                >
                  {bank.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bank.logo}
                      alt=""
                      width={22}
                      height={22}
                      className="h-[22px] w-[22px] shrink-0 rounded"
                    />
                  )}
                  {/* Wraps to two lines rather than truncating: half the bank
                      names here are longer than one grid cell ("Trade and
                      Development bank", "National investment bank"), and a
                      payer cannot pick the bank they hold an account with if
                      the name is cut off. */}
                  <span className="line-clamp-2 min-w-0">{bank.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-900">
        {status === "waiting" && (
          <>
            {/* Real state, not decoration: lit while the page is actively
                asking QPay whether the invoice has been paid. */}
            <span
              className={`h-2 w-2 shrink-0 rounded-full bg-amber-500 ${
                checking ? "motion-safe:animate-pulse" : ""
              }`}
              aria-hidden="true"
            />
            <span className="text-zinc-700 dark:text-zinc-300">{labels.waiting}</span>
          </>
        )}
        {status === "timedout" && (
          <span className="text-zinc-700 dark:text-zinc-300">{labels.timedout}</span>
        )}
        {status === "error" && (
          <span className="text-zinc-700 dark:text-zinc-300">{labels.error}</span>
        )}
      </div>

      {status !== "waiting" && (
        <button
          type="button"
          onClick={() => {
            settled.current = false;
            startedAt.current = Date.now();
            setStatus("waiting");
            void check();
          }}
          className="w-full rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-transform hover:bg-zinc-700 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {labels.checkAgain}
        </button>
      )}
    </div>
  );
}

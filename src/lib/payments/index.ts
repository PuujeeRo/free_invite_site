import { MockPaymentProvider } from "./mock";
import { QPayProvider, qpayCredentials } from "./qpay";
import { StripeProvider, isStripeConfigured } from "./stripe";
import type { PaymentProvider, PaymentProviderName } from "./types";

function isQPayConfigured(): boolean {
  return Boolean(qpayCredentials() && process.env.QPAY_INVOICE_CODE);
}

function build(name: PaymentProviderName): PaymentProvider {
  switch (name) {
    case "qpay":
      return new QPayProvider();
    case "stripe":
      return new StripeProvider();
    case "mock":
      return new MockPaymentProvider();
  }
}

/**
 * Resolves which payment provider to use.
 *
 * PAYMENT_PROVIDER pins it explicitly (and deliberately throws if that
 * provider's credentials are missing -- a misconfigured deploy should fail
 * loudly rather than quietly falling back to the mock provider and handing out
 * free upgrades). With it unset, QPay wins when configured, then Stripe, and
 * the mock provider is the last resort so the app still runs with no
 * credentials at all.
 */
export function getPaymentProvider(): PaymentProvider {
  const pinned = process.env.PAYMENT_PROVIDER?.toLowerCase();

  if (pinned === "qpay" || pinned === "stripe" || pinned === "mock") {
    if (pinned === "qpay" && !isQPayConfigured()) {
      throw new Error(
        "PAYMENT_PROVIDER=qpay but QPAY_USERNAME/QPAY_PASSWORD/QPAY_INVOICE_CODE are not all set"
      );
    }
    if (pinned === "stripe" && !isStripeConfigured()) {
      throw new Error("PAYMENT_PROVIDER=stripe but STRIPE_SECRET_KEY is not set");
    }
    return build(pinned);
  }

  if (pinned) {
    throw new Error(`Unknown PAYMENT_PROVIDER "${pinned}" (expected qpay, stripe, or mock)`);
  }

  if (isQPayConfigured()) return build("qpay");
  if (isStripeConfigured()) return build("stripe");
  return build("mock");
}

export type {
  PaymentProvider,
  PaymentProviderName,
  CreateInvoiceParams,
  CreateInvoiceResult,
} from "./types";

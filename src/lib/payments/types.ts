export type PaymentProviderName = "qpay" | "stripe" | "mock";

export interface CreateInvoiceParams {
  eventId: string;
  paymentId: string;
  amount: number;
  description: string;
}

// One bank/wallet app QPay offers as a deeplink for this invoice.
export interface CheckoutDeeplink {
  name: string;
  description?: string;
  logo?: string;
  link: string;
}

// Everything needed to render a checkout surface ourselves, for providers (QPay)
// that hand back a QR payload rather than a hosted checkout page. Persisted on
// the payment row so the checkout page can re-render without minting a second
// invoice. Absent for providers whose checkoutUrl is a real hosted page.
export interface CheckoutPayload {
  qrImage?: string | null; // base64 PNG, no data: prefix
  qrText?: string | null; // raw EMV QR string, for rendering a QR ourselves
  shortUrl?: string | null; // QPay's own hosted fallback page
  deeplinks?: CheckoutDeeplink[];
}

export interface CreateInvoiceResult {
  providerRef: string;
  // Where to send the organizer to complete payment.
  checkoutUrl: string;
  checkout?: CheckoutPayload;
}

export interface PaymentProvider {
  name: PaymentProviderName;
  // ISO 4217 code the provider will actually bill in. Recorded on the payment
  // row so the amount is never ambiguous (QPay is always MNT; a Stripe account
  // may be set up to charge in something else).
  currency: string;
  createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResult>;
}

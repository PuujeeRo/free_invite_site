// One bank/wallet app QPay offers as a deeplink for this invoice.
export interface CheckoutDeeplink {
  name: string;
  description?: string;
  logo?: string;
  link: string;
}

// Everything needed to render a checkout surface ourselves, for QPay, which
// hands back a QR payload rather than a hosted checkout page. Persisted on the
// tip row so the checkout page can re-render without minting a second invoice.
export interface CheckoutPayload {
  qrImage?: string | null; // base64 PNG, no data: prefix
  qrText?: string | null; // raw EMV QR string, for rendering a QR ourselves
  shortUrl?: string | null; // QPay's own hosted fallback page
  deeplinks?: CheckoutDeeplink[];
}

export interface CreateInvoiceParams {
  // Sent to QPay as sender_invoice_no; for a tip, the tip's id.
  invoiceNo: string;
  amount: number;
  description: string;
  // Where QPay pings when the invoice is paid (not trusted on its own) and
  // where the payer is sent to pay.
  callbackUrl: string;
  checkoutUrl: string;
}

export interface CreateInvoiceResult {
  providerRef: string;
  checkoutUrl: string;
  checkout?: CheckoutPayload;
}

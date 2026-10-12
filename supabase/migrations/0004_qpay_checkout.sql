-- QPay is not a hosted-checkout gateway the way Stripe is: its v2 /invoice
-- response hands back the QR payload and the per-bank deeplinks, and the
-- merchant is expected to render its own checkout surface from them.
--
-- Storing that response lets /pay/qpay/[paymentId] be a normal server-rendered
-- page (reload-safe, shareable to the payer's phone) instead of something that
-- has to re-create a fresh invoice on every render -- re-creating would leak a
-- new QPay invoice per page view and leave the payer looking at a QR that the
-- callback no longer maps to this payment row.
alter table public.payments
  add column if not exists checkout jsonb;

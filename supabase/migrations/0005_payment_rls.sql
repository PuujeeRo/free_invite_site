-- Makes the paid upgrade actually possible, and actually necessary.
--
-- Two problems this fixes, both found by running the upgrade flow end to end
-- against a real RLS-enforcing database for the first time.
--
-- 1. `payments` had RLS enabled with only a SELECT policy. Postgres denies
--    anything a policy does not permit, so the INSERT in startCheckout was
--    always refused and the organizer was bounced straight back to
--    /upgrade?error=1. The paid plan could not be bought at all.
--
-- 2. `events_owner_all` is an ALL policy over every column, so an organizer
--    could PATCH their own event row and set is_paid = true themselves, with
--    nothing but their own anon-key token. The upgrade was free for anyone
--    willing to call the API directly, which makes the payment flow decorative.
--
-- The shape of the fix follows the rule the rest of this schema already uses
-- (see the guest-limit trigger in 0001): the database enforces it, so it holds
-- regardless of which client or key performs the write.

-- ---------- 1. let an organizer open a checkout for their own event ----------

-- Insert is restricted to a pending row on an event the caller owns. Creating
-- a row that is already 'paid' is the obvious way to abuse an insert policy,
-- so the status is pinned here rather than trusted from the client.
drop policy if exists "payments_owner_insert" on public.payments;
create policy "payments_owner_insert" on public.payments
  for insert with check (
    status = 'pending'
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.organizer_id = auth.uid()
    )
  );

-- Update exists only so startCheckout can attach provider_ref and the stored
-- checkout payload after the gateway responds, and mark the row failed if the
-- gateway call throws. Flipping a row to 'paid' is deliberately NOT possible
-- here: that transition belongs to markPaymentPaid, which runs with the
-- service-role key after QPay has confirmed the payment, and bypasses RLS.
drop policy if exists "payments_owner_update" on public.payments;
create policy "payments_owner_update" on public.payments
  for update using (
    status <> 'paid'
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.organizer_id = auth.uid()
    )
  ) with check (
    status <> 'paid'
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.organizer_id = auth.uid()
    )
  );

-- ---------- 2. stop an organizer unlocking their own event for free ----------

-- RLS alone cannot express this: a WITH CHECK clause sees only the new row, so
-- it cannot tell "is_paid was already true" from "the caller just set it". A
-- BEFORE UPDATE trigger can compare OLD and NEW, so the guard lives here.
--
-- The role test is what separates a paying organizer from the payment webhook:
-- PostgREST and Supabase both SET ROLE from the JWT's role claim, so an
-- organizer arrives as `authenticated` and a guest as `anon`, while the
-- service-role key used by markPaymentPaid arrives as `service_role`.
--
-- Deliberately SECURITY INVOKER (the default), NOT security definer: inside a
-- security-definer function current_user is the function's OWNER rather than
-- the caller, so the role test would read the same for everyone and the guard
-- would lock out the payment webhook along with the organizer.
--
-- The check is phrased as a denylist of the two end-user roles rather than an
-- allowlist of privileged ones, so it keeps working under whatever role
-- migrations happen to run as, and stays correct if Supabase adds another
-- internal role.
create or replace function public.guard_event_paid_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.is_paid is distinct from old.is_paid
     or new.paid_at is distinct from old.paid_at then
    raise exception 'is_paid and paid_at are set by the payment webhook, not by the organizer'
      using errcode = 'P0002';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_event_paid_columns on public.events;
create trigger guard_event_paid_columns
  before update on public.events
  for each row execute function public.guard_event_paid_columns();

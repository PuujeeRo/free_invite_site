-- Free-plan guest limit including the seasonal categories added in 0012.
--
-- Identical to the function in 0008_event_type_limits.sql except that
-- 'new_year' and 'tsagaan_sar' join the list of big event types: a New Year
-- party is an office- or class-sized gathering, and Tsagaan Sar brings the
-- whole extended family through the door.
--
-- Must match freeGuestLimit in src/lib/event-types.ts for every type;
-- scripts/verify-db.ts asserts that against a real database.
create or replace function public.enforce_rsvp_limit()
returns trigger
language plpgsql
as $$
declare
  v_event public.events%rowtype;
  v_limit int;
  v_count int;
begin
  select * into v_event from public.events where id = new.event_id;

  if v_event.is_paid then
    return new;
  end if;

  if v_event.event_type in ('wedding', 'graduation', 'hair_cutting', 'reunion', 'corporate', 'new_year', 'tsagaan_sar') then
    v_limit := 100;
  else
    v_limit := 10;
  end if;

  select count(*) into v_count from public.rsvps where event_id = new.event_id;

  if v_count >= v_limit then
    raise exception 'guest_limit_reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

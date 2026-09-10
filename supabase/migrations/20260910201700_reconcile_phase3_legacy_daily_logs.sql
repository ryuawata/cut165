begin;

-- Reconcile the mutable legacy daily snapshot immediately before the runtime
-- switches to the Phase 1 history tables. The unique user/date key makes this
-- repeatable and deliberately propagates cleared legacy metric values.
insert into public.daily_metrics (
  user_id,
  log_date,
  steps,
  water_oz,
  cardio_minutes,
  notes
)
select
  dl.user_id,
  dl.log_date,
  dl.steps,
  dl.water_oz,
  nullif(dl.cardio_minutes, 0),
  nullif(btrim(dl.notes), '')
from public.daily_logs as dl
where dl.user_id is not null
on conflict (user_id, log_date) do update
set
  steps = excluded.steps,
  water_oz = excluded.water_oz,
  cardio_minutes = excluded.cardio_minutes,
  notes = excluded.notes;

-- Refresh only measurements previously imported from the matching legacy row.
-- A manual/import measurement occupying the same user/date is preserved.
insert into public.body_measurements (
  user_id,
  log_date,
  weight_lbs,
  source,
  source_ref
)
select
  dl.user_id,
  dl.log_date,
  dl.weight_lbs,
  'legacy',
  'daily_logs:' || coalesce(
    to_jsonb(dl) ->> 'id',
    dl.user_id::text || ':' || dl.log_date::text
  ) || ':weight'
from public.daily_logs as dl
where dl.user_id is not null
  and dl.weight_lbs is not null
on conflict (user_id, log_date) do update
set
  weight_lbs = excluded.weight_lbs,
  source_ref = excluded.source_ref
where body_measurements.source = 'legacy'
  and body_measurements.source_ref = excluded.source_ref;

-- If legacy weight was explicitly cleared, remove only its exact compatibility
-- import. Measurements from every other source remain intact.
delete from public.body_measurements as bm
using public.daily_logs as dl
where dl.user_id is not null
  and dl.weight_lbs is null
  and bm.user_id = dl.user_id
  and bm.log_date = dl.log_date
  and bm.source = 'legacy'
  and bm.source_ref = 'daily_logs:' || coalesce(
    to_jsonb(dl) ->> 'id',
    dl.user_id::text || ':' || dl.log_date::text
  ) || ':weight';

-- Ensure each true legacy strength flag has exactly one compatibility session.
-- These rows intentionally have no completed_at because the legacy schema did
-- not record a completion timestamp.
insert into public.workout_sessions (
  user_id,
  scheduled_date,
  workout_code,
  status,
  completed_at,
  source,
  source_ref
)
select
  dl.user_id,
  dl.log_date,
  'legacy_strength',
  'completed',
  null,
  'legacy',
  'daily_logs:' || coalesce(
    to_jsonb(dl) ->> 'id',
    dl.user_id::text || ':' || dl.log_date::text
  ) || ':strength'
from public.daily_logs as dl
where dl.user_id is not null
  and dl.strength is true
on conflict (user_id, source, source_ref) where source_ref is not null do update
set
  scheduled_date = excluded.scheduled_date,
  workout_code = excluded.workout_code,
  status = excluded.status,
  completed_at = excluded.completed_at
where workout_sessions.source = 'legacy'
  and workout_sessions.workout_code = 'legacy_strength';

-- Remove only a matching legacy compatibility session when its source flag is
-- now false. Structured/manual/scheduled sessions are never candidates.
delete from public.workout_sessions as ws
using public.daily_logs as dl
where dl.user_id is not null
  and dl.strength is false
  and ws.user_id = dl.user_id
  and ws.scheduled_date = dl.log_date
  and ws.workout_code = 'legacy_strength'
  and ws.source = 'legacy'
  and ws.source_ref = 'daily_logs:' || coalesce(
    to_jsonb(dl) ->> 'id',
    dl.user_id::text || ':' || dl.log_date::text
  ) || ':strength';

commit;

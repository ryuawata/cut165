begin;

-- A legacy CUT165 user is an auth user with app history on or before the
-- original campaign target date. The earliest historical log date is the
-- campaign start date; the migration date is deliberately irrelevant.
with legacy_history as (
  select user_id, log_date
  from public.daily_logs
  where user_id is not null
    and log_date <= date '2026-11-11'

  union all

  select user_id, log_date
  from public.body_measurements
  where user_id is not null
    and log_date <= date '2026-11-11'
),
eligible_legacy_users as (
  select history.user_id, min(history.log_date) as start_date
  from legacy_history as history
  join auth.users as users on users.id = history.user_id
  group by history.user_id
)
insert into public.profiles (
  user_id,
  onboarding_complete
)
select
  eligible.user_id,
  false
from eligible_legacy_users as eligible
on conflict (user_id) do nothing;

-- Preserve every existing goal. Only users with no active goal receive the
-- historical CUT165 goal, and the partial unique index is the final guard
-- against concurrent creation of a second active goal.
with legacy_history as (
  select user_id, log_date
  from public.daily_logs
  where user_id is not null
    and log_date <= date '2026-11-11'

  union all

  select user_id, log_date
  from public.body_measurements
  where user_id is not null
    and log_date <= date '2026-11-11'
),
eligible_legacy_users as (
  select history.user_id, min(history.log_date) as start_date
  from legacy_history as history
  join auth.users as users on users.id = history.user_id
  group by history.user_id
)
insert into public.goals (
  user_id,
  goal_type,
  start_weight_lbs,
  target_weight_lbs,
  start_date,
  target_date,
  status
)
select
  eligible.user_id,
  'cut',
  180,
  165,
  eligible.start_date,
  date '2026-11-11',
  'active'
from eligible_legacy_users as eligible
where not exists (
  select 1
  from public.goals as existing_goal
  where existing_goal.user_id = eligible.user_id
    and existing_goal.status = 'active'
)
on conflict (user_id) where status = 'active' do nothing;

-- Fill only a matching historical CUT165 goal with no target history at all.
-- Carbohydrates and weekly change were ranges/guidance rather than canonical
-- historical facts, so they remain NULL instead of inventing a point value.
with legacy_history as (
  select user_id, log_date
  from public.daily_logs
  where user_id is not null
    and log_date <= date '2026-11-11'

  union all

  select user_id, log_date
  from public.body_measurements
  where user_id is not null
    and log_date <= date '2026-11-11'
),
eligible_legacy_users as (
  select history.user_id, min(history.log_date) as start_date
  from legacy_history as history
  join auth.users as users on users.id = history.user_id
  group by history.user_id
)
insert into public.goal_targets (
  goal_id,
  user_id,
  effective_from,
  calorie_target_min,
  calorie_target_max,
  protein_target_g,
  carb_target_g,
  steps_target,
  water_target_oz,
  weekly_weight_change_target_lbs,
  source
)
select
  goal.id,
  goal.user_id,
  goal.start_date,
  1650,
  1800,
  145,
  null,
  5000,
  80,
  null,
  'legacy'
from eligible_legacy_users as eligible
join public.goals as goal
  on goal.user_id = eligible.user_id
 and goal.goal_type = 'cut'
 and goal.start_weight_lbs = 180
 and goal.target_weight_lbs = 165
 and goal.start_date = eligible.start_date
 and goal.target_date = date '2026-11-11'
 and goal.status = 'active'
where not exists (
  select 1
  from public.goal_targets as existing_target
  where existing_target.goal_id = goal.id
)
on conflict do nothing;

commit;

begin;

alter table public.profiles
  add column activity_level text not null default 'light';

alter table public.profiles
  add constraint profiles_activity_level_check
  check (activity_level in ('sedentary', 'light', 'moderate', 'very_active'));

create or replace function public.replace_goal_target(
  p_user_id uuid,
  p_goal_id uuid,
  p_effective_from date,
  p_target_weight_lbs numeric,
  p_target_date date,
  p_calorie_target_min integer,
  p_calorie_target_max integer,
  p_protein_target_g numeric,
  p_carb_target_g numeric,
  p_steps_target bigint,
  p_water_target_oz numeric,
  p_weekly_weight_change_target_lbs numeric,
  p_source text
)
returns public.goal_targets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_goal public.goals;
  v_same_day public.goal_targets;
  v_current public.goal_targets;
  v_result public.goal_targets;
begin
  if p_effective_from is null then
    raise exception 'Effective date is required';
  end if;

  if p_source not in ('onboarding', 'manual', 'system', 'coach', 'legacy') then
    raise exception 'Invalid goal target source';
  end if;

  select * into v_goal
  from public.goals
  where id = p_goal_id
    and user_id = p_user_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'Active goal not found for user';
  end if;

  update public.goals
  set target_weight_lbs = p_target_weight_lbs,
      target_date = p_target_date
  where id = p_goal_id
    and user_id = p_user_id
    and status = 'active';

  select * into v_same_day
  from public.goal_targets
  where goal_id = p_goal_id
    and user_id = p_user_id
    and effective_from = p_effective_from
  for update;

  if found then
    if v_same_day.calorie_target_min = p_calorie_target_min
      and v_same_day.calorie_target_max = p_calorie_target_max
      and v_same_day.protein_target_g = p_protein_target_g
      and v_same_day.carb_target_g is not distinct from p_carb_target_g
      and v_same_day.steps_target = p_steps_target
      and v_same_day.water_target_oz = p_water_target_oz
      and v_same_day.weekly_weight_change_target_lbs is not distinct from p_weekly_weight_change_target_lbs
    then
      return v_same_day;
    end if;

    raise exception 'A goal target version already begins on this date';
  end if;

  select * into v_current
  from public.goal_targets
  where goal_id = p_goal_id
    and user_id = p_user_id
    and effective_from < p_effective_from
    and (effective_to is null or p_effective_from < effective_to)
  order by effective_from desc
  limit 1
  for update;

  if found then
    update public.goal_targets
    set effective_to = p_effective_from
    where id = v_current.id
      and goal_id = p_goal_id
      and user_id = p_user_id;
  end if;

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
  ) values (
    p_goal_id,
    p_user_id,
    p_effective_from,
    p_calorie_target_min,
    p_calorie_target_max,
    p_protein_target_g,
    p_carb_target_g,
    p_steps_target,
    p_water_target_oz,
    p_weekly_weight_change_target_lbs,
    p_source
  )
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.replace_goal_target(
  uuid, uuid, date, numeric, date, integer, integer, numeric, numeric,
  bigint, numeric, numeric, text
) from public, anon, authenticated;

grant execute on function public.replace_goal_target(
  uuid, uuid, date, numeric, date, integer, integer, numeric, numeric,
  bigint, numeric, numeric, text
) to service_role;

commit;

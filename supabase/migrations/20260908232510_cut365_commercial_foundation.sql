begin;

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  birth_year smallint,
  energy_estimation_sex text,
  height_inches numeric(5,2),
  timezone text not null default 'UTC',
  weight_unit text not null default 'lb',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_birth_year_check check (birth_year is null or birth_year >= 1900),
  constraint profiles_energy_estimation_sex_check check (energy_estimation_sex is null or energy_estimation_sex in ('male', 'female')),
  constraint profiles_height_inches_check check (height_inches is null or height_inches > 0),
  constraint profiles_timezone_check check (btrim(timezone) <> ''),
  constraint profiles_weight_unit_check check (weight_unit in ('lb', 'kg'))
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_type text not null,
  start_weight_lbs numeric(6,2) not null,
  target_weight_lbs numeric(6,2) not null,
  start_date date not null,
  target_date date,
  status text not null default 'active',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_id_user_id_key unique (id, user_id),
  constraint goals_goal_type_check check (goal_type in ('cut', 'maintain', 'bulk')),
  constraint goals_start_weight_check check (start_weight_lbs > 0),
  constraint goals_target_weight_check check (target_weight_lbs > 0),
  constraint goals_target_date_check check (target_date is null or target_date >= start_date),
  constraint goals_status_check check (status in ('active', 'completed', 'paused', 'abandoned'))
);

create table public.goal_targets (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_from date not null,
  effective_to date,
  calorie_target_min integer not null,
  calorie_target_max integer not null,
  protein_target_g numeric(6,1) not null,
  carb_target_g numeric(6,1),
  steps_target bigint not null,
  water_target_oz numeric(7,2) not null,
  weekly_weight_change_target_lbs numeric(5,2),
  source text not null,
  created_at timestamptz not null default now(),
  constraint goal_targets_goal_owner_fkey foreign key (goal_id, user_id)
    references public.goals(id, user_id),
  constraint goal_targets_no_overlap exclude using gist (
    goal_id with =,
    daterange(effective_from, effective_to, '[)') with &&
  ),
  constraint goal_targets_effective_dates_check check (effective_to is null or effective_to > effective_from),
  constraint goal_targets_calorie_min_check check (calorie_target_min >= 0),
  constraint goal_targets_calorie_max_check check (calorie_target_max >= 0),
  constraint goal_targets_calorie_range_check check (calorie_target_min <= calorie_target_max),
  constraint goal_targets_protein_check check (protein_target_g >= 0),
  constraint goal_targets_carb_check check (carb_target_g is null or carb_target_g >= 0),
  constraint goal_targets_steps_check check (steps_target >= 0),
  constraint goal_targets_water_check check (water_target_oz >= 0),
  constraint goal_targets_source_check check (source in ('onboarding', 'manual', 'system', 'coach', 'legacy'))
);

create table public.nutrition_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  consumed_at timestamptz,
  entry_type text not null,
  meal_slot text,
  description text not null,
  calories numeric(8,1),
  protein_g numeric(6,1),
  carbs_g numeric(6,1),
  fat_g numeric(6,1),
  alcohol_servings numeric(5,2),
  source text not null,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_entries_entry_type_check check (entry_type in ('food', 'drink', 'supplement', 'quick_add', 'legacy')),
  constraint nutrition_entries_meal_slot_check check (meal_slot is null or meal_slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  constraint nutrition_entries_source_check check (source in ('manual', 'quick_add', 'legacy', 'ai', 'import')),
  constraint nutrition_entries_description_check check (btrim(description) <> ''),
  constraint nutrition_entries_source_ref_check check (source_ref is null or btrim(source_ref) <> ''),
  constraint nutrition_entries_calories_check check (calories is null or calories >= 0),
  constraint nutrition_entries_protein_check check (protein_g is null or protein_g >= 0),
  constraint nutrition_entries_carbs_check check (carbs_g is null or carbs_g >= 0),
  constraint nutrition_entries_fat_check check (fat_g is null or fat_g >= 0),
  constraint nutrition_entries_alcohol_servings_check check (alcohol_servings is null or alcohol_servings >= 0),
  constraint nutrition_entries_has_metric_check check (
    calories is not null or protein_g is not null or carbs_g is not null or
    fat_g is not null or alcohol_servings is not null
  )
);

create table public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  steps bigint,
  water_oz numeric(7,2),
  cardio_minutes integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_metrics_user_date_key unique (user_id, log_date),
  constraint daily_metrics_steps_check check (steps is null or steps >= 0),
  constraint daily_metrics_water_check check (water_oz is null or water_oz >= 0),
  constraint daily_metrics_cardio_minutes_check check (cardio_minutes is null or cardio_minutes >= 0)
);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  measured_at timestamptz,
  weight_lbs numeric(6,2) not null,
  body_fat_pct numeric(5,2),
  lean_mass_lbs numeric(6,2),
  source text not null,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint body_measurements_user_date_key unique (user_id, log_date),
  constraint body_measurements_weight_check check (weight_lbs > 0),
  constraint body_measurements_body_fat_check check (body_fat_pct is null or body_fat_pct between 0 and 100),
  constraint body_measurements_lean_mass_check check (lean_mass_lbs is null or lean_mass_lbs >= 0),
  constraint body_measurements_source_check check (source in ('manual', 'legacy', 'import')),
  constraint body_measurements_source_ref_check check (source_ref is null or btrim(source_ref) <> '')
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_date date not null,
  workout_code text not null,
  status text not null default 'planned',
  completed_at timestamptz,
  duration_minutes integer,
  notes text,
  source text not null,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_sessions_workout_code_check check (workout_code in ('full_body_a', 'full_body_b', 'full_body_c', 'recovery', 'custom', 'legacy_strength')),
  constraint workout_sessions_status_check check (status in ('planned', 'completed', 'skipped')),
  constraint workout_sessions_duration_check check (duration_minutes is null or duration_minutes >= 0),
  constraint workout_sessions_source_check check (source in ('manual', 'schedule', 'legacy', 'ai')),
  constraint workout_sessions_source_ref_check check (source_ref is null or btrim(source_ref) <> '')
);

create unique index goals_one_active_per_user_idx on public.goals (user_id) where status = 'active';
create index goals_user_status_idx on public.goals (user_id, status);

create index goal_targets_goal_user_idx on public.goal_targets (goal_id, user_id);
create index goal_targets_user_effective_from_idx on public.goal_targets (user_id, effective_from desc);

create index nutrition_entries_user_log_date_idx on public.nutrition_entries (user_id, log_date, created_at);
create unique index nutrition_entries_source_ref_idx
  on public.nutrition_entries (user_id, source, source_ref)
  where source_ref is not null;

create unique index body_measurements_source_ref_idx
  on public.body_measurements (user_id, source, source_ref)
  where source_ref is not null;
create index workout_sessions_user_scheduled_date_idx
  on public.workout_sessions (user_id, scheduled_date, created_at);
create unique index workout_sessions_source_ref_idx
  on public.workout_sessions (user_id, source, source_ref)
  where source_ref is not null;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger goals_set_updated_at before update on public.goals
for each row execute function public.set_updated_at();
create trigger nutrition_entries_set_updated_at before update on public.nutrition_entries
for each row execute function public.set_updated_at();
create trigger daily_metrics_set_updated_at before update on public.daily_metrics
for each row execute function public.set_updated_at();
create trigger body_measurements_set_updated_at before update on public.body_measurements
for each row execute function public.set_updated_at();
create trigger workout_sessions_set_updated_at before update on public.workout_sessions
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.goal_targets enable row level security;
alter table public.nutrition_entries enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.body_measurements enable row level security;
alter table public.workout_sessions enable row level security;

create policy "profiles_manage_own" on public.profiles for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goals_select_own" on public.goals for select to authenticated
using ((select auth.uid()) = user_id);
create policy "goals_insert_own" on public.goals for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "goals_update_own" on public.goals for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goal_targets_select_own" on public.goal_targets for select to authenticated
using ((select auth.uid()) = user_id);
create policy "nutrition_entries_manage_own" on public.nutrition_entries for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "daily_metrics_manage_own" on public.daily_metrics for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "body_measurements_manage_own" on public.body_measurements for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workout_sessions_manage_own" on public.workout_sessions for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on table public.profiles, public.goals, public.goal_targets,
  public.nutrition_entries, public.daily_metrics, public.body_measurements,
  public.workout_sessions from public, anon;
grant select, insert, update, delete on table public.profiles,
  public.nutrition_entries, public.daily_metrics, public.body_measurements,
  public.workout_sessions to authenticated;
grant select, insert, update on table public.goals to authenticated;
grant select on table public.goal_targets to authenticated;
grant select, insert, update, delete on table public.goal_targets to service_role;

create view public.daily_nutrition_totals
with (security_invoker = true)
as
select
  user_id,
  log_date,
  sum(calories) as calories,
  sum(protein_g) as protein_g,
  sum(carbs_g) as carbs_g,
  sum(fat_g) as fat_g,
  sum(alcohol_servings) as alcohol_servings,
  count(*) filter (where calories is null)::bigint as calories_unknown_count,
  count(*) filter (where protein_g is null)::bigint as protein_unknown_count,
  count(*) filter (where carbs_g is null)::bigint as carbs_unknown_count,
  count(*) filter (where fat_g is null)::bigint as fat_unknown_count,
  count(*) filter (where alcohol_servings is null)::bigint as alcohol_unknown_count,
  count(*)::bigint as entry_count
from public.nutrition_entries
group by user_id, log_date;

revoke all on table public.daily_nutrition_totals from public, anon;
grant select on table public.daily_nutrition_totals to authenticated;

insert into public.nutrition_entries (
  user_id, log_date, entry_type, description, calories, protein_g, carbs_g,
  alcohol_servings, source, source_ref
)
select
  user_id,
  log_date,
  'legacy',
  'Legacy daily total',
  calories,
  protein_g,
  carbs_g,
  alcohol_drinks,
  'legacy',
  'daily_logs:' || coalesce(to_jsonb(dl) ->> 'id', user_id::text || ':' || log_date::text)
from public.daily_logs as dl
on conflict (user_id, source, source_ref) where source_ref is not null do nothing;

insert into public.daily_metrics (user_id, log_date, steps, water_oz, cardio_minutes, notes)
select user_id, log_date, steps, water_oz, cardio_minutes, notes
from public.daily_logs
on conflict (user_id, log_date) do nothing;

insert into public.body_measurements (user_id, log_date, weight_lbs, source, source_ref)
select
  user_id,
  log_date,
  weight_lbs,
  'legacy',
  'daily_logs:' || coalesce(to_jsonb(dl) ->> 'id', user_id::text || ':' || log_date::text) || ':weight'
from public.daily_logs as dl
where weight_lbs is not null
on conflict (user_id, log_date) do nothing;

insert into public.workout_sessions (user_id, scheduled_date, workout_code, status, source, source_ref)
select
  user_id,
  log_date,
  'legacy_strength',
  'completed',
  'legacy',
  'daily_logs:' || coalesce(to_jsonb(dl) ->> 'id', user_id::text || ':' || log_date::text) || ':strength'
from public.daily_logs as dl
where strength is true
on conflict (user_id, source, source_ref) where source_ref is not null do nothing;

commit;

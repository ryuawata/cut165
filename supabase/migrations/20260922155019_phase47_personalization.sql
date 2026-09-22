begin;

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_code text not null,
  name text not null,
  focus text not null default '',
  exercises jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_templates_user_code_key unique (user_id, workout_code),
  constraint workout_templates_workout_code_check check (workout_code in ('full_body_a', 'full_body_b')),
  constraint workout_templates_name_check check (btrim(name) <> ''),
  constraint workout_templates_exercises_check check (
    jsonb_typeof(exercises) = 'array' and jsonb_array_length(exercises) > 0
  )
);

create table public.nutrition_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  meal_slot text,
  calories numeric(8,1),
  protein_g numeric(6,1),
  carbs_g numeric(6,1),
  fat_g numeric(6,1),
  alcohol_servings numeric(5,2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_presets_name_check check (btrim(name) <> ''),
  constraint nutrition_presets_meal_slot_check check (
    meal_slot is null or meal_slot in ('breakfast', 'lunch', 'dinner', 'snack')
  ),
  constraint nutrition_presets_calories_check check (calories is null or calories >= 0),
  constraint nutrition_presets_protein_check check (protein_g is null or protein_g >= 0),
  constraint nutrition_presets_carbs_check check (carbs_g is null or carbs_g >= 0),
  constraint nutrition_presets_fat_check check (fat_g is null or fat_g >= 0),
  constraint nutrition_presets_alcohol_check check (alcohol_servings is null or alcohol_servings >= 0),
  constraint nutrition_presets_sort_order_check check (sort_order >= 0),
  constraint nutrition_presets_has_metric_check check (
    calories is not null or protein_g is not null or carbs_g is not null or
    fat_g is not null or alcohol_servings is not null
  )
);

create index nutrition_presets_user_sort_idx
  on public.nutrition_presets (user_id, sort_order, created_at);

alter table public.workout_sessions
  add column workout_snapshot jsonb;

alter table public.workout_sessions
  add constraint workout_sessions_snapshot_check check (
    workout_snapshot is null or jsonb_typeof(workout_snapshot) = 'object'
  );

alter table public.nutrition_entries
  drop constraint nutrition_entries_entry_type_check,
  drop constraint nutrition_entries_calories_check,
  drop constraint nutrition_entries_protein_check,
  drop constraint nutrition_entries_carbs_check,
  drop constraint nutrition_entries_fat_check,
  drop constraint nutrition_entries_alcohol_servings_check;

alter table public.nutrition_entries
  add constraint nutrition_entries_entry_type_check check (
    entry_type in ('food', 'drink', 'supplement', 'quick_add', 'legacy', 'adjustment')
  ),
  add constraint nutrition_entries_calories_check check (
    calories is null or entry_type = 'adjustment' or calories >= 0
  ),
  add constraint nutrition_entries_protein_check check (
    protein_g is null or entry_type = 'adjustment' or protein_g >= 0
  ),
  add constraint nutrition_entries_carbs_check check (
    carbs_g is null or entry_type = 'adjustment' or carbs_g >= 0
  ),
  add constraint nutrition_entries_fat_check check (
    fat_g is null or fat_g >= 0
  ),
  add constraint nutrition_entries_alcohol_servings_check check (
    alcohol_servings is null or alcohol_servings >= 0
  ),
  add constraint nutrition_entries_adjustment_source_ref_check check (
    entry_type <> 'adjustment' or (
      source_ref is not null and
      source = 'manual' and
      num_nonnulls(calories, protein_g, carbs_g) = 1 and
      fat_g is null and alcohol_servings is null
    )
  );

create trigger workout_templates_set_updated_at before update on public.workout_templates
for each row execute function public.set_updated_at();
create trigger nutrition_presets_set_updated_at before update on public.nutrition_presets
for each row execute function public.set_updated_at();

alter table public.workout_templates enable row level security;
alter table public.nutrition_presets enable row level security;

create policy "workout_templates_manage_own" on public.workout_templates
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "nutrition_presets_manage_own" on public.nutrition_presets
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.workout_templates, public.nutrition_presets from public, anon, authenticated;
grant select, insert, update, delete on table
  public.workout_templates, public.nutrition_presets
to authenticated;
grant select, insert, update, delete on table
  public.workout_templates, public.nutrition_presets
to service_role;

create or replace view public.daily_nutrition_totals
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
  count(*) filter (where calories is null and entry_type <> 'adjustment')::bigint as calories_unknown_count,
  count(*) filter (where protein_g is null and entry_type <> 'adjustment')::bigint as protein_unknown_count,
  count(*) filter (where carbs_g is null and entry_type <> 'adjustment')::bigint as carbs_unknown_count,
  count(*) filter (where fat_g is null and entry_type <> 'adjustment')::bigint as fat_unknown_count,
  count(*) filter (where alcohol_servings is null and entry_type <> 'adjustment')::bigint as alcohol_unknown_count,
  count(*)::bigint as entry_count
from public.nutrition_entries
group by user_id, log_date;

revoke all on table public.daily_nutrition_totals from public, anon;
grant select on table public.daily_nutrition_totals to authenticated;

commit;

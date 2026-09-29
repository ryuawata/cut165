begin;

alter table public.nutrition_entries
  drop constraint nutrition_entries_meal_slot_check,
  add constraint nutrition_entries_meal_slot_check check (
    meal_slot is null or meal_slot in ('breakfast', 'lunch', 'dinner', 'snack', 'drink')
  );

alter table public.nutrition_presets
  drop constraint nutrition_presets_meal_slot_check,
  add constraint nutrition_presets_meal_slot_check check (
    meal_slot is null or meal_slot in ('breakfast', 'lunch', 'dinner', 'snack', 'drink')
  );

create table public.custom_workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  format text not null,
  category text not null,
  description text,
  external_url text,
  duration_minutes integer,
  exercises jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_workout_templates_id_user_key unique (id, user_id),
  constraint custom_workout_templates_name_check check (btrim(name) <> ''),
  constraint custom_workout_templates_format_check check (format in ('structured', 'guided')),
  constraint custom_workout_templates_category_check check (category in ('strength', 'cardio', 'mobility', 'other')),
  constraint custom_workout_templates_description_check check (description is null or btrim(description) <> ''),
  constraint custom_workout_templates_external_url_check check (
    external_url is null or btrim(external_url) ~* '^https?://'
  ),
  constraint custom_workout_templates_duration_check check (duration_minutes is null or duration_minutes between 1 and 1440),
  constraint custom_workout_templates_exercises_check check (
    jsonb_typeof(exercises) = 'array' and
    (format <> 'structured' or jsonb_array_length(exercises) > 0)
  ),
  constraint custom_workout_templates_sort_order_check check (sort_order >= 0)
);

create index custom_workout_templates_user_sort_idx
  on public.custom_workout_templates (user_id, sort_order, created_at);

alter table public.workout_sessions
  drop constraint workout_sessions_workout_code_check,
  add constraint workout_sessions_workout_code_check check (
    workout_code in (
      'full_body_a', 'full_body_b', 'full_body_c', 'recovery', 'custom', 'legacy_strength',
      'custom_strength', 'custom_cardio', 'custom_mobility', 'custom_other'
    )
  ),
  add column custom_workout_template_id uuid,
  add constraint workout_sessions_custom_template_owner_fkey
    foreign key (custom_workout_template_id, user_id)
    references public.custom_workout_templates(id, user_id)
    on delete set null (custom_workout_template_id);

create index workout_sessions_custom_template_idx
  on public.workout_sessions (custom_workout_template_id)
  where custom_workout_template_id is not null;

create trigger custom_workout_templates_set_updated_at
before update on public.custom_workout_templates
for each row execute function public.set_updated_at();

alter table public.custom_workout_templates enable row level security;

create policy "custom_workout_templates_manage_own"
on public.custom_workout_templates
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.custom_workout_templates from public, anon, authenticated;
grant select, insert, update, delete on table public.custom_workout_templates to authenticated;
grant select, insert, update, delete on table public.custom_workout_templates to service_role;

commit;

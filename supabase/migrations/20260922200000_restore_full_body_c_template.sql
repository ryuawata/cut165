begin;

alter table public.workout_templates
  drop constraint workout_templates_workout_code_check;

alter table public.workout_templates
  add constraint workout_templates_workout_code_check check (
    workout_code in ('full_body_a', 'full_body_b', 'full_body_c')
  );

commit;

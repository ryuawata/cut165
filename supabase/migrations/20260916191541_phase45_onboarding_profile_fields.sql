begin;

alter table public.profiles
  add column exercise_frequency text not null default 'none',
  add column getting_started_dismissed boolean not null default false;

alter table public.profiles
  add constraint profiles_exercise_frequency_check
  check (exercise_frequency in ('none', 'one_to_two', 'three_to_four', 'five_plus'));

commit;

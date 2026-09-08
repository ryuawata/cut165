begin;

revoke all on table
  public.profiles,
  public.goals,
  public.goal_targets,
  public.nutrition_entries,
  public.daily_metrics,
  public.body_measurements,
  public.workout_sessions,
  public.daily_nutrition_totals
from authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.nutrition_entries,
  public.daily_metrics,
  public.body_measurements,
  public.workout_sessions
to authenticated;

grant select, insert, update
  on table public.goals
  to authenticated;

grant select
  on table public.goal_targets, public.daily_nutrition_totals
  to authenticated;

commit;

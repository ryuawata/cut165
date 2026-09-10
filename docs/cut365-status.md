# CUT365 status

## Current phase

- Phase 1: complete in production.
- Phase 2 nutrition cutover: complete.
- Phase 3 daily metrics, body measurements, and workouts: complete on the `cut365-phase-3` feature branch.
- The Phase 3 reconciliation migration has not been applied to production.

## Decisions

- Preserve legacy tables and use an additive migration.
- Preserve goal history; clients transition goal status instead of deleting goals.
- Keep historical, non-overlapping `[)` goal targets read-only to authenticated clients; server/service-role writes only.
- Use `workout_sessions`, `alcohol_servings`, nullable nutrition values with completeness counts, ownership RLS, and idempotent legacy imports.
- Nutrition source of truth is `nutrition_entries`; displayed daily totals come from the derived `daily_nutrition_totals` view.
- `daily_logs` is a deprecated legacy table with no active runtime usage. It remains intact for historical compatibility and reconciliation.
- Keep AI and photo logging out of this phase.

## Next task

Plan goals, profiles, onboarding, and productization. AI and photo logging remain deferred.

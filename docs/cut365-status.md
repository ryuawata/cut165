# CUT365 status

## Current phase

Phase 1 database foundation is complete in production. Phase 2 nutrition-entry cutover is complete and validated on the `cut365-phase-2` feature branch. Production was not modified during Phase 2.

## Decisions

- Preserve legacy tables and use an additive migration.
- Preserve goal history; clients transition goal status instead of deleting goals.
- Keep historical, non-overlapping `[)` goal targets read-only to authenticated clients; server/service-role writes only.
- Use `workout_sessions`, `alcohol_servings`, nullable nutrition values with completeness counts, ownership RLS, and idempotent legacy imports.
- Nutrition source of truth is `nutrition_entries`; displayed daily totals come from the derived `daily_nutrition_totals` view.
- Remaining non-nutrition data continues to use legacy `daily_logs` during the incremental cutover.
- Keep AI and photo logging out of this phase.

## Next task

Review and merge the `cut365-phase-2` feature branch. Do not begin Phase 3 until Phase 2 is accepted; AI and photo logging remain deferred.

# CUT365 status

## Current phase

Commercial-foundation migration approved and locally validated. Remote application and post-migration verification have been requested in the separate “Cut 165 App Development” task, but completion has not yet been verified. Nothing has been committed or pushed here.

## Decisions

- Preserve legacy tables and use an additive migration.
- Preserve goal history; clients transition goal status instead of deleting goals.
- Keep historical, non-overlapping `[)` goal targets read-only to authenticated clients; server/service-role writes only.
- Use `workout_sessions`, `alcohol_servings`, nullable nutrition values with completeness counts, ownership RLS, and idempotent legacy imports.
- Keep AI and photo logging out of this phase.

## Next task

Review the other task's apply and post-migration verification results. If they pass, record Phase 1 as applied and begin Phase 2: migrate the CUT365 UI to the new nutrition-entry model.

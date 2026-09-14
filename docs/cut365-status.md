# CUT365 status

## Current phase

- Phase 1: complete in production.
- Phase 2 nutrition cutover: complete in production.
- Phase 3 daily metrics, body measurements, and workouts: complete in production.
- The Phase 3 reconciliation migration has been applied and verified in production.
- Current phase: Phase 4 profiles, goals, onboarding, and dynamic targets on the `cut365-phase-4` feature branch.
- The Phase 4 migration has not been applied to production.
- The Phase 4 legacy bootstrap migration has not been applied to production.

## Decisions

- Preserve legacy tables and use an additive migration.
- Preserve goal history; clients transition goal status instead of deleting goals.
- Keep historical, non-overlapping `[)` goal targets read-only to authenticated clients; server/service-role writes only.
- Use `workout_sessions`, `alcohol_servings`, nullable nutrition values with completeness counts, ownership RLS, and idempotent legacy imports.
- Nutrition source of truth is `nutrition_entries`; displayed daily totals come from the derived `daily_nutrition_totals` view.
- `daily_logs` is a deprecated legacy table with no active runtime usage. It remains intact for historical compatibility and reconciliation.
- CUT365 is the master product identity; each active goal derives its own CUT number from the target weight.
- Authenticated clients retain read-only access to effective-dated goal targets. A narrow authenticated server route validates the caller and uses a server-only credential to invoke the atomic target-versioning function.
- Legacy CUT165 users are bootstrapped from historical dates without invented demographic data. Their incomplete compatibility profile does not block dashboard access and is not falsely marked complete.
- Profile Settings completes legacy calculation fields without changing goal history or recalculating targets; goal editing unlocks immediately after the profile save.
- An incomplete legacy compatibility profile may replace the schema-default `UTC` placeholder with the browser-detected IANA timezone once; completed or customized profiles and historical `log_date` values remain unchanged.
- Phase 4 deployment requires a server-only `SUPABASE_SECRET_KEY`; it must never be exposed as a `NEXT_PUBLIC_` variable.
- Keep AI and photo logging out of this phase.

## Next task

Review and apply both Phase 4 database migrations, then configure the server-only `SUPABASE_SECRET_KEY` before deploying the Phase 4 application. Subscriptions, payments, AI coaching, photo logging, Apple Health, and native apps remain deferred.

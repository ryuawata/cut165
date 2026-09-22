# CUT365 status

## Current phase

- Phase 1: complete in production.
- Phase 2 nutrition cutover: complete in production.
- Phase 3 daily metrics, body measurements, and workouts: complete in production.
- The Phase 3 reconciliation migration has been applied and verified in production.
- Phase 4 profiles, goals, onboarding, and dynamic targets: live.
- Phase 4.5 new-user onboarding hardening: live.
- Current phase: Phase 4.6 beta coaching and domain cutover on the `cut365-phase-4-6` feature branch.

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
- Phase 4.5 adds a constrained exercise-frequency profile value and a persistent first-day prompt dismissal. Exercise frequency does not influence calorie estimates. New-user plans expose an editable step and water target, and unsafe requested dates are constrained to the fastest allowed pace.
- Phase 4.6 derives a weekly training recommendation from exercise frequency: `none` and `one_to_two` map to 2 workouts, `three_to_four` maps to 3, and `five_plus` maps to 4. This is a training target only and remains excluded from calorie calculations.
- Beta training alternates Full Body A and B from the user's most recent completed session. Planned, open, or skipped sessions do not advance the sequence. Weekly completion uses Monday–Sunday boundaries in the profile timezone.
- Dashboard coaching is deterministic and derived from current profile, effective targets, daily facts, and workout history. It is never persisted as generated text, and incomplete protein totals never produce falsely precise remaining-protein guidance.
- The canonical public product identity is CUT365 at `https://cut365.app`. Dynamic goal identities such as CUT165 remain intentional and distinct from the master brand.
- Phase 4 deployment requires a server-only `SUPABASE_SECRET_KEY`; it must never be exposed as a `NEXT_PUBLIC_` variable.
- Keep AI and photo logging out of this phase.

## Next task

Before merging Phase 4.6, verify the Vercel production domain configuration treats `https://cut365.app` as primary and redirects `https://www.cut365.app` to it. In Supabase Auth, verify the Site URL is `https://cut365.app` and the production CUT365 origin is present in the allowed redirect URLs. No Phase 4.6 database migration is required. Subscriptions, payments, AI coaching, photo logging, Apple Health, and native apps remain deferred.

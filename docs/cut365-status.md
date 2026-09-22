# CUT365 status

## Current phase

- Phase 1: complete in production.
- Phase 2 nutrition cutover: complete in production.
- Phase 3 daily metrics, body measurements, and workouts: complete in production.
- The Phase 3 reconciliation migration has been applied and verified in production.
- Phase 4 profiles, goals, onboarding, and dynamic targets: live.
- Phase 4.5 new-user onboarding hardening: live.
- Phase 4.6 beta coaching and domain cutover: complete on `main`.
- Current phase: Phase 4.7 beta UX and personalization on the `cut365-phase-4-7` feature branch. Its additive migration is intentionally unapplied pending review.

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
- Phase 4.7 caps the full-body recommendation at 2 weekly sessions for `none` and `one_to_two`, and 3 for `three_to_four` and `five_plus`. Two-session plans require two full rest calendar days; three-session plans require one. Weekly completion and recovery spacing derive from completed A/B sessions in the profile timezone. Next-workout sequence and today's eligibility are separate facts.
- Full Body A/B starter templates remain immutable fallbacks. Users may persist owned overrides, while newly completed sessions store the effective workout snapshot so later edits cannot rewrite history. Legacy strength stays distinct and never advances A/B rotation.
- Quick Add now means user-owned nutrition presets. Logging copies the preset's current values into an ordinary nutrition entry; later preset edits or deletion do not change history. One-off Add Meal remains separate.
- Consumer calorie UI shows one rounded midpoint goal while effective-dated target history continues storing the calorie minimum and maximum.
- Calories and protein use transparent, deterministic per-day correction entries for replacement edits; incomplete aggregates cannot be replaced. Steps, water, notes, and weight use field-level persistence, so there is no global Save Today action.
- The Drinks, Optional Cardio, and Today's Guidance dashboard experiences are removed. Their historical database fields and records remain intact.
- The canonical public product identity is CUT365 at `https://cut365.app`. Dynamic goal identities such as CUT165 remain intentional and distinct from the master brand.
- Phase 4 deployment requires a server-only `SUPABASE_SECRET_KEY`; it must never be exposed as a `NEXT_PUBLIC_` variable.
- Keep AI and photo logging out of this phase.

## Next task

Review and apply `20260922155019_phase47_personalization.sql` before deploying Phase 4.7 application code, then merge only after the migration and preview are approved. Subscriptions, payments, AI coaching, photo logging, Apple Health, notifications, and native apps remain deferred.

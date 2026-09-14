# CUT365 architecture

## Data ownership and history

PostgreSQL is the source of truth for CUT365. Event and history records—nutrition entries, daily metrics, body measurements, and workout sessions—belong to the user and are not owned by a goal. Completing, pausing, abandoning, or replacing a goal must not erase a user's history. Normal application users transition goal status rather than physically deleting goals; account deletion still cascades from `auth.users` through all user-owned data.

Goal targets are versioned historically in `goal_targets`. Each target has an inclusive `effective_from` date and an optional exclusive `effective_to` date, allowing CUT365 to reproduce the targets that applied on any past day without overwriting prior guidance. Overlapping effective ranges for the same goal are rejected by the database.

Phase 4 introduces the product bootstrap flow: authentication → profile → active goal → effective target. A new user first saves a profile and current body measurement, creates exactly one active goal, then requests an initial target version. The profile is marked complete only after all required records exist, so interrupted onboarding can safely resume without creating duplicate profiles or active goals. Existing users with a profile, active goal, and current target bypass onboarding; older complete account data is adopted without rewriting history.

An idempotent compatibility migration discovers legacy users from `daily_logs` and `body_measurements`, derives the original goal start from their earliest historical date, and fills only missing profile, CUT165 goal, and initial target records. It never updates an existing profile, goal, or target. Because legacy history cannot establish birth year, energy-estimation sex, height, or a canonical carbohydrate point target, those values remain NULL. The compatibility profile remains `onboarding_complete = false`, but the complete goal/target tuple permits normal dashboard use. The application only finalizes onboarding automatically when the calculation profile fields genuinely exist. The shared Settings panel lets a legacy user complete the missing profile details without re-onboarding; that save updates only the profile and unlocks Goal Settings. Targets are recalculated and versioned only after a separate, explicit goal save.

Initial calorie, protein, carbohydrate, step, water, and weekly-change targets are calculated deterministically in shared application code using Mifflin–St Jeor energy estimation, an activity multiplier, conservative goal-rate limits, and calorie safety floors. They are planning estimates rather than medical advice. The calculation does not use BMI as a nutrition target.

The database enforces a stable lower bound for `birth_year`. Whether a year is in the future depends on the current date, so the upper-bound check belongs in shared application validation rather than a static database constraint that would age poorly.

The user-selected `log_date` is the authoritative calendar date for daily logging. A profile's IANA `timezone` is used when server-side workflows need to determine concepts such as today or yesterday; timestamps alone must not silently reassign a record to another log date.

Dashboard goal targets are effective-dated with inclusive start and exclusive end semantics. Historical dates load the target that covered that date; today's dashboard loads today's target. Goal progress uses the active goal's start and target weights plus the latest body measurement and supports both loss and gain directions. The personalized CUT identity is derived at runtime from the active target weight, while CUT365 remains the product brand.

Daily nutrition totals are derived from `nutrition_entries` through `daily_nutrition_totals`. They are not copied into a stored or cached summary table. This prevents separately stored totals and entries from drifting apart.

The application reads and writes all current user-history domains through the Phase 1 commercial schema: nutrition through `nutrition_entries` and `daily_nutrition_totals`, daily signals through `daily_metrics`, weight through `body_measurements`, and training history through `workout_sessions`. Presentation code uses typed domain services and does not read from or write to legacy `daily_logs`.

The deprecated `daily_logs` table remains intact for historical compatibility. Before the Phase 3 runtime cutover, an idempotent reconciliation migration copies its latest meaningful state into the commercial history tables without replacing manual/import measurements or non-legacy workout sessions.

## Privileged goal-target boundary

Browser clients cannot insert, update, or delete `goal_targets`. They send an authenticated request to the narrow CUT365 goal-target route. The route independently validates the access token, resolves only the caller's profile, active goal, and latest eligible measurement, recalculates the complete target server-side, and invokes a single atomic database function with a server-only Supabase secret. The function is executable only by `service_role`, scopes every operation to the supplied user and active goal, closes the prior `[)` range, and inserts the replacement version in one transaction. It is not a general database proxy.

Phase 4 deployment requires `SUPABASE_SECRET_KEY` in the server runtime. It must never use the `NEXT_PUBLIC_` prefix or be shipped to browser code.

## Application and AI boundaries

The user interface and any future AI capabilities must use shared domain services for authorization, validation, date handling, goal-target lookup, and persistence. Business or safety policy thresholds belong in those application services, not in database constraints.

LLMs must never receive direct SQL access or database credentials. Any future model integration must operate through narrowly scoped, authenticated application tools that enforce the same domain rules as the UI.

No AI functionality is implemented in this phase. Photo logging is also out of scope.

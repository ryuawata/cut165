# CUT365 architecture

## Data ownership and history

PostgreSQL is the source of truth for CUT365. Event and history records—nutrition entries, daily metrics, body measurements, and workout sessions—belong to the user and are not owned by a goal. Completing, pausing, abandoning, or replacing a goal must not erase a user's history. Normal application users transition goal status rather than physically deleting goals; account deletion still cascades from `auth.users` through all user-owned data.

Goal targets are versioned historically in `goal_targets`. Each target has an inclusive `effective_from` date and an optional exclusive `effective_to` date, allowing CUT365 to reproduce the targets that applied on any past day without overwriting prior guidance. Overlapping effective ranges for the same goal are rejected by the database.

The database enforces a stable lower bound for `birth_year`. Whether a year is in the future depends on the current date, so the upper-bound check belongs in shared application validation rather than a static database constraint that would age poorly.

The user-selected `log_date` is the authoritative calendar date for daily logging. A profile's IANA `timezone` is used when server-side workflows need to determine concepts such as today or yesterday; timestamps alone must not silently reassign a record to another log date.

Daily nutrition totals are derived from `nutrition_entries` through `daily_nutrition_totals`. They are not copied into a stored or cached summary table. This prevents separately stored totals and entries from drifting apart.

## Application and AI boundaries

The user interface and any future AI capabilities must use shared domain services for authorization, validation, date handling, goal-target lookup, and persistence. Business or safety policy thresholds belong in those application services, not in database constraints.

LLMs must never receive direct SQL access or database credentials. Any future model integration must operate through narrowly scoped, authenticated application tools that enforce the same domain rules as the UI.

No AI functionality is implemented in this phase. Photo logging is also out of scope.

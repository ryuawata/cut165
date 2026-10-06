<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CUT365 Agent Instructions

## Project

CUT365 is a mobile-first health and fitness tracking application.

Primary stack:

- Next.js App Router
- React
- TypeScript
- Supabase
- PostgreSQL
- Vercel

PostgreSQL is the source of truth.

The application tracks things such as:

- nutrition
- calories
- protein
- carbs
- weight
- water
- activity
- workouts
- goals
- historical daily data

Treat this as a production application. Favor correctness, maintainability, data integrity, and predictable user behavior over clever implementations.

---

# Agent Responsibilities

Own assigned engineering tasks end to end.

For normal implementation work:

1. Inspect the relevant existing code before making changes.
2. Understand the current architecture and conventions.
3. Determine the smallest appropriate implementation.
4. Implement the change.
5. Add or update tests where appropriate.
6. Run relevant validation.
7. Review your own diff as a senior engineer.
8. Fix issues discovered during self-review.
9. Leave the branch in a PR-ready state.

Do not require separate architect, developer, and reviewer workflows for routine work.

Architecture, implementation, and self-review are phases of the same task.

---

# When to Ask the User

Prefer making reasonable engineering decisions independently.

Do not interrupt the user for:

- implementation details that can be inferred from the existing code
- naming choices that follow current conventions
- minor UI decisions already established elsewhere in the product
- refactors required to complete the requested feature safely
- test implementation details
- ordinary technical tradeoffs with a clearly superior option

Ask the user only when a decision is genuinely ambiguous and materially affects:

- product behavior
- user experience
- data semantics
- destructive data changes
- authentication or authorization behavior
- billing or monetization
- privacy or security
- major architecture direction
- irreversible migrations
- third-party services requiring credentials or approval

When uncertain, inspect more of the repository before asking.

---

# General Engineering Principles

Prefer:

- simple implementations
- explicit behavior
- small diffs
- existing abstractions
- existing naming conventions
- server-side enforcement for important invariants
- database constraints for database invariants
- deterministic behavior
- idempotent operations where practical

Avoid:

- unnecessary abstractions
- speculative architecture
- large unrelated refactors
- duplicated business logic
- hidden side effects
- client-side logic as the sole enforcement of important rules
- changing existing behavior unless required by the task

Do not redesign working systems solely because another architecture is theoretically cleaner.

---

# Source of Truth

PostgreSQL is the canonical source of truth for persisted application data.

Derived UI state must not silently become authoritative over persisted data.

For time-sensitive or historical data, prefer deriving behavior from persisted facts rather than recalculating history using today's settings.

Historical records should remain stable unless the user explicitly edits them.

Example:

If a workout was historically assigned or completed on September 29, changing workout preferences on October 1 must not unexpectedly rewrite what September 29 displays as having occurred.

When working on history or scheduling features, explicitly consider the difference between:

- historical facts
- generated recommendations
- current preferences
- future projections

Do not conflate them.

---

# Dates and Timezones

The user's profile timezone is authoritative for day boundaries.

Use the profile IANA timezone when determining:

- today's date
- daily totals
- workout dates
- nutrition dates
- historical entries
- goal applicability
- effective date ranges

Do not assume UTC midnight represents the user's day boundary.

Avoid storing ambiguous date/time values.

When a concept represents a calendar day rather than a moment in time, model and compare it as a date where appropriate.

---

# Goal Targets

Goal targets are versioned using effective date ranges.

Existing architecture uses concepts such as:

- `effective_from`
- `effective_to`

Historical goals must remain reproducible.

Changing a current goal should not rewrite prior days.

Prevent overlapping effective ranges.

Respect database constraints protecting goal-target history.

Do not bypass existing service-layer behavior for goal mutations unless the task specifically requires changing that architecture.

---

# Nutrition

Nutrition entries are persisted events.

Daily nutrition totals should be derived from entries rather than treated as independent mutable truth unless existing architecture explicitly requires otherwise.

Important tracked values include:

- calories
- protein
- carbs

Some nutrition values may be unknown.

Preserve the application's unknown-count behavior rather than silently interpreting missing values as zero.

Zero and unknown are different states.

When modifying nutrition behavior, verify:

- creating entries
- editing entries
- deleting entries
- historical dates
- daily aggregation
- unknown values
- legacy imported records

Legacy imports should remain idempotent.

---

# Workouts

Workout history must be deterministic.

A past day must not unexpectedly change merely because:

- today's date changed
- preferences changed
- the workout schedule was regenerated
- another day was completed
- the UI recalculated a sequence differently

Explicitly distinguish between:

- planned workouts
- completed workouts
- rest days
- generated future workouts
- historical workouts

When changing workout scheduling, test date transitions and historical behavior.

Do not calculate historical workout identity solely from a mutable current-state sequence if doing so can alter the past.

---

# Supabase and Database

Treat database changes as high risk.

Before introducing a migration, determine whether the requirement can safely be implemented without one.

For migrations:

- preserve existing data
- avoid destructive changes unless explicitly required
- make constraints intentional
- consider rollback behavior
- consider existing production rows
- avoid application-model dependencies inside migrations where practical
- avoid long-running row-by-row migration logic
- keep data migrations idempotent when possible

For RLS:

- assume RLS is an important security boundary
- never weaken policies merely to make implementation easier
- explicitly consider authenticated-user isolation
- verify users cannot access another user's data

Existing goal-target behavior includes authenticated read access with privileged mutations. Preserve that boundary unless explicitly changing it.

Never expose `service_role` credentials to the browser.

---

# Authentication and Authorization

Never trust client-provided user IDs as authorization.

Derive authenticated identity from the trusted authentication context.

Any query involving user-owned data must be scoped appropriately.

Check authorization when:

- reading records
- editing records
- deleting records
- creating records linked to users
- invoking server actions or API routes

Do not rely solely on hidden UI controls to protect privileged behavior.

---

# Next.js

Follow existing App Router conventions.

Prefer server-side behavior where it improves correctness or security, but do not convert client components unnecessarily.

Be deliberate about:

- server vs client components
- cache behavior
- stale data
- revalidation
- optimistic updates
- navigation after mutations
- hydration behavior
- loading states
- error states

Do not introduce caching around user-specific dynamic data unless the behavior is clearly safe.

After mutations, ensure the UI cannot continue displaying stale persisted state indefinitely.

---

# React

Favor predictable state flow.

Avoid duplicating persisted server state into long-lived local state without a reason.

Watch for:

- stale closures
- race conditions
- effects firing more than intended
- dependency-array mistakes
- optimistic state not reconciling with the server
- duplicated event submissions
- state derived from outdated props
- date-dependent rendering inconsistencies

Do not use effects when the value can be derived directly during render.

---

# TypeScript

Maintain strong typing.

Avoid introducing:

- `any`
- unsafe casts
- unnecessary non-null assertions

If an external boundary returns uncertain data, validate it.

Prefer narrowing over casting.

Types should reflect actual runtime possibilities, particularly for nullable or unknown nutrition values.

---

# Validation

Use existing validation conventions.

If the project uses Zod or equivalent validation in the affected area, preserve that pattern.

Validate important input at trusted boundaries, not only inside UI controls.

Client validation improves UX.

Server validation protects correctness.

Both may be appropriate.

---

# Mobile-First UI

CUT365 is primarily a phone application.

When modifying UI:

- design for mobile first
- make primary actions easy to reach
- avoid dense desktop-oriented layouts
- preserve clear hierarchy
- maintain sufficient touch targets
- avoid unnecessary modal complexity
- minimize typing where possible
- keep common logging actions fast

The established visual direction is:

- quiet white interface
- clean
- premium
- restrained
- strong typography
- generous spacing
- category colors used for scanning, not judgment

Existing category colors should remain consistent unless the task explicitly changes them.

Do not add decorative UI merely to make a screen feel more "designed."

---

# Product Behavior

Favor low-friction tracking.

Important interactions should generally be:

- fast
- reversible
- understandable
- forgiving of corrections

Editing previous days is a supported product behavior.

Do not assume today's date is the only writable period.

Be careful when changing behavior involving:

- add amount
- replace total
- edit entry
- delete entry
- correct previous day
- undo
- pending saves
- failed saves

The UI must communicate whether an operation succeeded.

Avoid silently losing user input.

---

# Error Handling

Do not swallow errors.

Handle errors at the layer capable of doing something useful with them.

For user-triggered operations:

- preserve user data where possible
- communicate failure
- allow retry where reasonable
- avoid falsely showing success

Logging should provide enough context to diagnose failures without exposing secrets or unnecessarily sensitive user information.

---

# Async Behavior

Pay special attention to:

- double submissions
- race conditions
- stale responses
- out-of-order responses
- optimistic updates
- navigation during pending operations
- retries
- duplicate records

Mutations that may be retried should be idempotent where practical.

Do not assume a request executes exactly once.

---

# Performance

Avoid premature optimization.

Still watch for obvious issues such as:

- N+1 database access
- repeated identical queries
- fetching entire datasets when only a subset is required
- unnecessary client bundles
- expensive computations during render
- excessive rerenders
- sequential requests that can safely execute concurrently

Performance improvements must not weaken correctness.

---

# Accessibility

Do not regress basic accessibility.

Interactive elements should:

- use appropriate semantic elements
- support keyboard interaction where relevant
- have accessible labels
- maintain understandable focus behavior
- not rely solely on color to communicate meaning

---

# Testing

Add or update tests when behavior changes.

Prioritize tests around:

- business logic
- historical behavior
- date boundaries
- authorization
- data integrity
- regression-prone code
- bugs being fixed

For bug fixes, prefer adding a regression test that fails before the fix and passes afterward.

Do not add low-value tests simply to increase coverage.

When touching scheduling or history logic, include representative past, present, and future dates where applicable.

---

# Required Validation

Before completing implementation work, run:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

Do not claim a task is complete if one of these fails unless the failure is clearly unrelated and explicitly reported.

Do not add isolated Supabase test infrastructure as routine setup. Introduce it only when work involving RLS, migrations, authentication behavior, goal-target persistence, or destructive data changes makes it necessary.

---

# Validation Before Completion

Before considering a task complete, run the relevant available checks.

Depending on the repository, this may include:

- tests
- lint
- TypeScript type checking
- production build

Use the project's actual scripts rather than inventing commands.

If the full suite is prohibitively expensive, run the most relevant targeted checks plus the standard static validation.

Do not claim a check passed unless it was actually run successfully.

If a check cannot be run, state why.

---

# Self-Review

After implementation, review the complete diff as if reviewing another senior engineer's pull request.

Do not merely verify that the requested feature appears to work.

Specifically inspect for:

## Behavior regressions

Could this alter existing functionality outside the requested change?

## Production risk

Could this fail only with real production data, concurrency, deployment ordering, caching, or scale?

## Data integrity

Could records become:

- duplicated
- orphaned
- overwritten
- historically inconsistent
- partially updated

## Historical consistency

Could today's settings change yesterday's displayed data?

Could regenerated state alter previously recorded behavior?

## Async timing

Could two requests or interactions produce an inconsistent result?

## Stale state

Could the UI show stale information after a successful mutation?

## Security

Could one user access or mutate another user's data?

Could secrets reach the client?

## Database migrations

If a migration exists:

- is it safe with existing rows?
- is deployment ordering safe?
- are constraints valid?
- could it lock or rewrite a large table unexpectedly?
- is rollback behavior acceptable?

## Tests

Would a reasonable regression escape because an important case is untested?

## Formatting and style

Only flag formatting or style concerns when they are significant enough to affect readability, maintainability, or consistency.

Do not waste review cycles on trivial style preferences.

Fix issues found during self-review before presenting the task as complete.

---

# Scope Control

Keep changes focused on the requested task.

Small supporting refactors are acceptable when they materially improve correctness or reduce duplication.

Do not bundle unrelated cleanup.

If unrelated technical debt is discovered, mention it separately rather than silently expanding scope.

---

# Existing Behavior

Before replacing or removing code that appears unnecessary, determine why it exists.

Check:

- call sites
- history implied by tests
- schema constraints
- comments
- neighboring code
- API consumers

Assume unusual behavior may exist for a reason until evidence suggests otherwise.

---

# Dependencies

Do not introduce a new dependency unless it provides clear value that is difficult to achieve with the existing stack.

Before adding one:

1. Check whether the project already has a suitable dependency.
2. Consider maintenance and bundle impact.
3. Prefer well-supported libraries.
4. Avoid dependencies for trivial utilities.

---

# Secrets

Never commit:

- API keys
- Supabase service-role keys
- passwords
- private tokens
- private credentials

Use environment variables and existing secret-management conventions.

Do not print secrets in logs or test output.

---

# Git and Pull Requests

Keep commits and diffs understandable.

Do not modify unrelated files.

Before finishing:

- inspect `git diff`
- inspect unexpected generated files
- ensure no secrets were introduced
- ensure temporary debugging code is removed
- ensure the branch contains only intended changes

A PR-ready task should include a concise summary of:

- what changed
- why
- important implementation decisions
- tests/checks run
- any remaining risks or follow-up work

Do not describe something as safe merely because tests pass.

---

# Review Severity

When reporting findings, prioritize issues that require action.

Use approximately:

- **Blocking**: must fix before merge
- **High**: significant correctness, security, production, or data-integrity concern
- **Medium**: meaningful issue worth addressing
- **Low**: minor improvement, usually non-blocking

Avoid flooding the user with cosmetic feedback.

If no meaningful issues remain, say the change is ready for final approval.

---

# Definition of Done

A task is done when:

- the requested behavior is implemented
- existing behavior has been considered
- relevant edge cases are handled
- authorization and data ownership remain correct
- relevant tests are added or updated
- appropriate validation passes
- the complete diff has been self-reviewed
- discovered blocking/high-severity issues have been fixed
- no unrelated changes remain
- the branch is ready for a pull request or review

The default goal is:

**one request in, one PR-ready implementation out.**

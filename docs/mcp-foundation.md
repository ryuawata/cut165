# Phase 5.0 MCP foundation

Status: implemented on `cut365-mcp-foundation`; not merged or enabled as an OAuth connector.

## Transport and access

`POST /api/mcp` uses the pinned stable v2 `@modelcontextprotocol/server` package and its web-standard `createMcpHandler` entry. The endpoint explicitly serves only protocol revision `2026-07-28` (`legacy: 'reject'`) with JSON responses. Clients discover the supported revision with `server/discover`, then send the selected protocol revision, client identity and client capabilities in the per-request `_meta` envelope. There is no `initialize` / `notifications/initialized` handshake, protocol session or `Mcp-Session-Id`. The SDK creates an isolated server instance for each request. No server SSE stream, subscriptions, resources, prompts or write tools are offered. Authenticated GET/DELETE and other unsupported methods return 405.

Every request, including `server/discover` and `tools/list`, requires `Authorization: Bearer <Supabase user access token>`. The server validates it with Supabase `auth.getUser(token)` and derives the user ID exclusively from that verified response. Domain reads use the publishable key and the same user bearer under existing RLS, plus existing ownership filters. Cookies, caller-supplied user IDs, service-role keys and SQL are not accepted. The endpoint does not bootstrap profiles or create any records.

This is a first-party bearer-auth foundation, **not the complete MCP OAuth authorization/discovery flow**. Clients must already have a CUT365 user session, supply a current access token and refresh it outside MCP. Do not configure a service key or paste tokens into tracked files. General ChatGPT connector OAuth setup and scoped consent remain future work.

Configuration uses existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Missing configuration fails closed. Optional `MCP_ALLOWED_ORIGINS` is a comma-separated list of exact trusted browser origins; unset rejects all requests containing Origin. Native clients without Origin are supported. There is no permissive CORS policy. POST bodies are limited to 16 KiB by the transport. Responses have `Cache-Control: no-store` and a generated `X-Request-Id`.

## Tool contract

`get_today_summary` takes `{}` (additional properties are rejected) and is annotated read-only, non-destructive and idempotent. It composes existing profile, active-goal, effective-target, daily-metrics, body-measurement, nutrition-total, workout-plan and workout-cadence services. The MCP modules contain no SQL, target calculation, nutrition aggregation or cadence rules.

The structured result includes date/timezone, a small goal projection, effective targets, nutrition totals with unknown counts, today's steps/water/weight, and program training state. Values retain their existing units: pounds, ounces, grams and calories. Null means missing/unrecorded; no missing value is converted to zero. Weight is today's recorded weight, not an inferred latest measurement. Nutrition includes entry count and unknown counts so partial totals are not represented as complete. Raw profile demographics, email, user IDs, freeform notes and workout snapshots are omitted.

Training `display` comes from the same resolver used by the dashboard. A rest display can still have the next sequence workout in `code`; consumers must not interpret that code alone as today's recommendation. Stored/completed sessions retain domain precedence. `completed` concerns the displayed program session; `completed_strength_this_week` also includes custom strength according to the existing service. This is not a complete custom workout activity feed.

Missing profile returns `{status:"profile_required",date:null}` without assuming UTC. Missing active goal/target returns null for those fields. A read failure returns a sanitized MCP `isError` result with `SUMMARY_UNAVAILABLE`, rather than partial success or database details.

## Errors, logs and verification

Authentication errors use HTTP 401 and a Bearer challenge; denied origins use 403; malformed protocol requests are handled by the SDK. Unexpected server failures return a generic structured JSON-RPC error and request ID. Request logs contain only event, generated request ID, status and duration; tool-failure logs include a fixed error code. Tokens, RPC bodies, user IDs, health data and raw exceptions are not logged. HTTP 200 can contain an MCP tool error; consult `mcp_tool_error` events too.

Run `npm test`, `npx tsc --noEmit`, `npm run build`, and `git diff --check` with Node 22+. The integration client pins `2026-07-28`, proves that discovery selects the modern era, and verifies that no legacy `initialize` request is sent. Tests also cover unknown tools/arguments, auth validation and bearer propagation, concurrency isolation, origin/method/media/version rejection, body bounds, redaction and real domain-reader ownership/timezone/null semantics. Preview deployment must be tied to the final commit. Live authenticated user-data verification requires a valid user session; mocked tests do not establish live RLS behavior.

No database migrations, Stripe, AI coaching, write tools or production promotion are included.

References: [MCP 2026-07-28 transport specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports), [MCP protocol versioning](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning), [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser).

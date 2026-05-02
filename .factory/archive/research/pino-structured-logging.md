---
tags:
  - factory
  - research
  - FantasyBaseball
  - observability
  - logging
project: FantasyBaseball
date: 2026-05-01
cycle: 2
source: factory-archivist
---

# Research: Pino Structured Logging for Next.js App Router

## Summary
Pino is the correct structured logging choice for this Next.js project. 117 `console.log`/`console.error` calls across `data.ts`, `espn.ts`, and API routes are replacement targets. Observability dimension currently 0.41 — target 0.7.

## Key Findings

### Library Choice
- Pino over Winston: faster, lower overhead, native JSON output, no synchronous transports that block the event loop in serverless
- Pino requires Node.js runtime — not compatible with Edge runtime. All API routes in this project use Node.js runtime (no `export const runtime = 'edge'`), so no issue.

### Next.js Config Required
```ts
// next.config.ts — prevents webpack from bundling pino
experimental: {
  serverComponentsExternalPackages: ["pino", "pino-pretty"],
}
```
In Next.js 15+, the key is `serverExternalPackages` (not `experimental`).

### Logger Singleton Pattern
```ts
// web/src/lib/logger.ts
import pino from "pino";
const logger = pino({
  level: process.env.NODE_ENV === "production" ? "warn" : "debug",
  ...(process.env.NODE_ENV !== "production" && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});
export default logger;
```

### Per-Module Child Logger
```ts
const log = logger.child({ module: "espn" }); // at top of each lib file
```
Attaches module name to every log line without repeating it per call.

### Per-Request Correlation (Critical Caveat)
AsyncLocalStorage does NOT reliably propagate from Next.js Middleware to Route Handlers in Next.js 14/15/16 (open issue, unresolved as of May 2026). Correct pattern:
1. `const reqId = crypto.randomUUID()` at top of each Route Handler
2. `const log = logger.child({ reqId, path: req.nextUrl.pathname })`
3. Pass `log` explicitly or use operation-scoped child loggers

### Required Fields
Every log call: `{ op, durationMs }`. ESPN API calls: `{ op: "espn_fetch", endpoint, teamId, scoringPeriodId, durationMs }`.

### Replacement Priority
1. `espn.ts` — external API calls, highest latency/error signal value
2. API route handlers
3. `data.ts`

## Sources
- Arcjet: Structured logging in JSON for Next.js
- Better Stack: Pino guide for Node.js
- Next.js AsyncLocalStorage propagation issue #67305 (GitHub)
- Dash0: Contextual logging with AsyncLocalStorage

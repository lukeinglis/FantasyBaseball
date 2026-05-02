---
tags:
  - factory
  - experiment
  - FantasyBaseball
project: FantasyBaseball
experiment_id: "007"
verdict: keep
score_delta: +0.0110
date: 2026-05-01
source: factory-archivist
---

# Experiment #007: Add pino structured logging with per-request tracing

## Hypothesis
Add pino structured logging with per-request tracing to all 26 API route handlers and `espn.ts` to lift the observability dimension from 0.41 toward 0.7+.

## Result
**KEEP** — score rose from 0.6075 to 0.6185 (delta: +0.0110). Observability dimension improved with structured logging now present across all API routes.

## What Changed
- Created `web/src/lib/logger.ts` — pino singleton with structured fields (reqId, op, durationMs)
- Added `serverExternalPackages: ['pino', 'pino-pretty']` to `next.config.ts`
- Instrumented all 26 API route handlers with request-scoped logging
- Instrumented `espn.ts` API calls with op/duration spans
- Key constraint: AsyncLocalStorage does NOT propagate from Middleware to Route Handlers in Next.js — per-handler reqId injection used instead

## Technical Note
The AsyncLocalStorage propagation limitation means reqId must be manually passed or generated per handler, not set once in middleware. This pattern is established and documented for future logging work.

## Links
- [[FantasyBaseball]]
- Issue: #16
- PR: #17

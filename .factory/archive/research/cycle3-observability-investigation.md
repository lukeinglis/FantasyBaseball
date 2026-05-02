---
tags:
  - factory
  - research
  - FantasyBaseball
  - observability
  - eval
project: FantasyBaseball
cycle: 3
date: 2026-05-01
source: factory-archivist
---

# Research: Observability Score 0.406 (Cycle 3)

## Finding

`eval_observability()` at `eval/score.py:74` scans only `*.py` files:

```python
sources = [f for f in Path(".").rglob("*.py")
           if not any(p in f.parts for p in skip)]
```

This is a JS/TS project. Zero `.py` source files exist (only eval/score.py itself, which is skipped). Result: `total_fn = 0`, early return with score 0.0.

Meanwhile, pino structured logging IS properly deployed:
- `web/src/lib/logger.ts` exports a pino singleton
- `web/src/lib/espn.ts` uses `log.info`/`log.error` with structured fields
- All API routes import and use the logger
- The `struct_pats` array already includes `r"\bpino\b"` but never matches because scan is limited to `.py`

## Fix

Rewrite `eval_observability()` to scan `.ts`, `.tsx`, `.js`, `.jsx` files. Replace Python `ast.parse` with regex-based function detection. Alternatively, add an observability dimension to eval_profile.json using grep-based shell commands.

## Impact

Fixing this alone could move observability from ~0.4 to ~0.7+, since pino is already deployed across all API routes.

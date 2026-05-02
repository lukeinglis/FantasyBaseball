---
tags:
  - factory
  - research
  - FantasyBaseball
  - testing
project: FantasyBaseball
date: 2026-05-01
source: factory-archivist
---

# Research: Vitest + MSW Testing Stack

## Current State
Zero tests. Zero test infrastructure. No vitest, jest, or testing-library in devDependencies.

## Recommended Stack
- **vitest**: Test runner (fast, Vite-native)
- **@vitejs/plugin-react**: JSX transform for tests
- **jsdom**: DOM environment for component tests
- **@testing-library/react + dom**: Component rendering/queries
- **vite-tsconfig-paths**: Resolve `@/` path aliases
- **msw**: Network-level API mocking

## Test Priority Order
1. Data transformations in `src/lib/`: CSV parsing, ESPN response normalization, z-score calculations
2. Edge case handling: Infinity, NaN, null, division by zero in stat computations
3. API route handlers: Mock ESPN API responses via MSW
4. Matchup projection math: Lock percentage, daily SD, category flip detection

## Caveats
- Async Server Components NOT supported by Vitest (use Playwright for E2E)
- MSW v2+ with jsdom may need polyfills for TextEncoder, BroadcastChannel
- Next.js 16 may have breaking API changes vs training data

## Sources
- [Next.js Official Vitest Guide](https://nextjs.org/docs/app/guides/testing/vitest) (updated 2026-04-10)
- [MSW Node.js Integration](https://mswjs.io/docs/integrations/node/)
- [MSW Quick Start](https://mswjs.io/docs/quick-start/)
- [Testing Next.js API Routes (nico.fyi)](https://www.nico.fyi/blog/how-to-unit-test-nextjs-api-route)

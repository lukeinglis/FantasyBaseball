---
tags:
  - factory
  - research
  - FantasyBaseball
  - draft-state
project: FantasyBaseball
date: 2026-05-01
source: factory-archivist
---

# Research: Draft State localStorage Fix

## Problem
`web/src/lib/draft-store.ts` holds draft state in a module-level variable. Vercel cold starts wipe it. Issue #3.

## Recommended Solution
Client-side localStorage as primary store with server reconciliation.

**Why localStorage wins:**
- Draft state is per-session, per-user, single-browser
- Survives serverless cold starts (lives in browser)
- No database needed for single-user draft tracker
- Data fits well within 5MB limit

**Implementation pattern:**
1. Move draft state to React context + `useReducer`
2. Persist to localStorage on every mutation via `useEffect`
3. Hydrate from localStorage on mount with SSR-safe guard
4. Keep API route as stateless pass-through
5. Use `"use client"` directive on draft page

**Alternatives rejected:**
- Cookies: 4KB limit too small for full draft board (300+ names)
- Vercel KV: Overkill for single-user state, adds paid dependency

## Sources
- [Next.js localStorage Guide (Restack)](https://www.restack.io/docs/nextjs-knowledge-nextjs-localstorage-guide)
- [Fix Next.js localStorage Hydration Errors (FluentReact)](https://www.fluentreact.com/blog/nextjs-localstorage-hydration-errors-fix)
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute)

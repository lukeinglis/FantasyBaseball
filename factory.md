# Factory Configuration

## Goal

Improve the reliability, code quality, and test coverage of a Next.js 16 fantasy baseball "War Room" web app that fetches live data from ESPN APIs. The app suffers from edge case crashes (Infinity, NaN, null from ESPN), fragile data transformations, and zero test coverage.

## Scope

### Modifiable

- web/src/**/*.ts
- web/src/**/*.tsx
- web/src/**/*.css
- web/package.json
- web/tsconfig.json
- eval/**

### Read-only

- README.md
- seasons/**
- owners/**
- analysis/**
- output/**
- data/**
- scripts/**

## Guards

- Do not delete or overwrite existing page components
- Do not modify files outside the declared scope
- Do not introduce secrets or credentials into the repository
- Do not change the ESPN league ID, team ID, or API endpoints
- Do not remove existing error handling or data sanitization
- Do not break the Vercel deployment (keep Next.js conventions)
- Do not add mock data that could be confused with real ESPN data

## Eval

### Command

```bash
cd web && npx tsc --noEmit 2>&1 | tail -1 && npx next lint 2>&1 | tail -5
```

### Threshold

0.7

## Target Branch

main

## Project Eval

### Dimensions

- type_safety: TypeScript strict mode compliance, no `any` types, proper null checks
- edge_case_handling: Sanitization for ESPN API edge cases (Infinity, NaN, null, division by zero, empty arrays)
- test_coverage: Unit and integration test coverage for data transformations and API utilities
- api_reliability: Proper error handling for ESPN API failures, timeouts, malformed responses

## Eval Weights

- hygiene: 40
- growth: 20
- project: 40

## Hypothesis Budget

- min_growth: 2
- max_new: 3

## Smoke Test

```bash
cd web && npx next build 2>&1 | tail -3
```

## Constraints

- Prefer small, incremental changes over large rewrites
- Each change should be accompanied by at least one test
- Follow the existing code style (Next.js App Router, Tailwind CSS, TypeScript strict)
- ESPN API data is unreliable: always sanitize numeric values before display
- The app is deployed on Vercel: all API routes must work as serverless functions

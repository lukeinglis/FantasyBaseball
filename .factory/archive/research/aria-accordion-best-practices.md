---
tags:
  - factory
  - research
  - FantasyBaseball
  - accessibility
project: FantasyBaseball
date: 2026-05-02
source: factory-archivist
---

# ARIA Accordion Best Practices

## Context
Researched for GM Advisor accordion UI (issue #37). The AccordionSection component in PR #38 lacks required ARIA attributes.

## Required Attributes (WAI-ARIA Pattern)

```jsx
<h3>
  <button id="btn-week" aria-expanded={isOpen} aria-controls="panel-week">
    This Week
  </button>
</h3>
<div id="panel-week" role="region" aria-labelledby="btn-week" hidden={!isOpen}>
  {content}
</div>
```

## Key Rules
- `aria-expanded` on trigger button: boolean reflecting open/closed state
- `aria-controls` on trigger: references panel `id`
- `role="region"` on panel: appropriate when <= 6 panels (this project has 3)
- `aria-labelledby` on panel: references button `id`
- `hidden` on collapsed panel: hides from keyboard and screen readers
- Keyboard: Enter/Space toggles, Tab navigates focusable elements

## Alternatives Considered
- Native `<details>/<summary>`: 2025 trend, but doesn't match existing design system styling
- `react-accessible-accordion`: deprecated in favor of native patterns

## Sources
- [WAI-ARIA Accordion Pattern (Aditus)](https://www.aditus.io/patterns/accordion/)
- [Accessible React Accordion (eevis.codes)](https://accessible-react.eevis.codes/components/accordion)
- [DEV: Building Accessible Accordion with React](https://dev.to/eevajonnapanula/expand-the-content-inclusively-building-an-accessible-accordion-with-react-2ded)
